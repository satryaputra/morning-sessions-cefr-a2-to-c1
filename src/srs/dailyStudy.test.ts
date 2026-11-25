import { describe, expect, it } from 'vitest';
import { STARTER_CARDS, STARTER_DECK_IDS } from '../data';
import { parseVocabImport } from '../importExport/csvParser';
import { createInitialAppState, getLocalDateKey, normalizeAppState } from '../storage/state';
import { getStudySentences, normalizeStudyAnswer } from './cloze';
import { completeListening, completeStudyAnswer, getDailyStudy, markStageFinished, undoListening } from './dailyStudy';
import { applyCardReview, calculateProgressStats, grantExtraNewCards, scheduleCardReview } from './engine';

const now = new Date(2026, 10, 25, 9);
const dateKey = getLocalDateKey(now);
const cards = STARTER_CARDS.filter((card) => card.deckId === STARTER_DECK_IDS.FONDASI).slice(0, 7);
const [old, ...newCards] = cards;

describe('Latihan harian', () => {
  it('resumes a fixed Listening list and puts those cards before scheduled review', () => {
    const earlier = new Date(2026, 10, 5, 9);
    const state = applyCardReview(createInitialAppState(), old, 'good', earlier).nextState;
    state.settings.dailyNewLimit = 5;
    const initial = getDailyStudy(state, cards, now);

    expect(initial.listening).toEqual(newCards.slice(0, 5));
    expect(initial.listeningCards).toEqual(newCards.slice(0, 5));
    expect(initial.cloze).toEqual([...initial.listening, old]);
    expect(initial.clozeCards).toEqual([...initial.listening, old]);
    expect(initial.dueCount).toBe(1);
    state.dailyStudy = initial.plan;
    expect(completeStudyAnswer(state, dateKey, newCards[0], 'good', now)).toBeNull();

    const half = completeListening(state, dateKey, newCards[0].id, 'hard');
    const restored = normalizeAppState(JSON.parse(JSON.stringify(half)));
    const resumed = getDailyStudy(restored, [...cards].reverse(), now);

    expect(resumed.listening).toEqual(newCards.slice(1, 5));
    expect(resumed.listeningCards).toEqual(newCards.slice(0, 5));
    expect(resumed.cloze).toEqual([...newCards.slice(0, 5), old]);
    expect(resumed.clozeCards).toEqual([...newCards.slice(0, 5), old]);
    expect(restored.dailyStudy?.listeningRatingsByCard?.[newCards[0].id]).toBe('hard');
    expect(restored.dailyActivity[dateKey].listeningRatings?.hard).toBe(1);
    expect(restored.dailyActivity[dateKey].reviews).toBe(0);
    expect(restored.progress).toEqual(state.progress);
    expect(restored.reviewHistory).toEqual(state.reviewHistory);

    const ready = newCards.slice(1, 5).reduce(
      (current, card) => completeListening(current, dateKey, card.id, 'good'),
      restored,
    );
    const first = completeStudyAnswer(ready, dateKey, newCards[0], 'good', now)!;
    expect(completeStudyAnswer(first.nextState, dateKey, newCards[0], 'good', now)?.nextState).toBe(first.nextState);
    expect(first.nextState.dailyActivity[dateKey].newStudied).toBe(1);
    expect(first.nextState.progress[newCards[0].id].reps).toBe(1);
    const today = calculateProgressStats({ cards, ...first.nextState, now }).calendarDays.at(-1)!;
    expect(today.listeningRatings).toMatchObject({ hard: 1, good: 4 });
    expect(today.ratings).toEqual({ again: 0, hard: 0, good: 1, easy: 0 });
  });

  it('supports idempotent Listening ratings, mid-session edits, undo, and lock after Tebak Kata', () => {
    const initial = createInitialAppState();
    const start = getDailyStudy(initial, [old], now);
    const state = { ...initial, dailyStudy: start.plan };

    const rated = completeListening(state, dateKey, old.id, 'easy');
    expect(completeListening(rated, dateKey, old.id, 'easy')).toBe(rated);
    expect(rated.dailyStudy?.listeningRatingsByCard?.[old.id]).toBe('easy');
    expect(getDailyStudy(rated, [old], now).listening).toEqual([]);
    expect(getDailyStudy(rated, [old], now).listeningCards).toEqual([old]);

    const changed = completeListening(rated, dateKey, old.id, 'hard');
    expect(changed.dailyStudy?.listeningRatingsByCard?.[old.id]).toBe('hard');
    expect(changed.dailyActivity[dateKey].listeningRatings?.easy).toBe(0);
    expect(changed.dailyActivity[dateKey].listeningRatings?.hard).toBe(1);

    const undone = undoListening(changed, dateKey, old.id, 'hard');
    expect(undone.dailyActivity[dateKey].listeningRatings?.hard).toBe(0);
    expect(undone.dailyStudy?.listeningRatingsByCard?.[old.id]).toBeUndefined();
    expect(getDailyStudy(undone, [old], now).listening).toEqual([old]);
    expect(undoListening(undone, dateKey, old.id, 'hard')).toBe(undone);

    const rerated = completeListening(undone, dateKey, old.id, 'easy');
    const answered = completeStudyAnswer(rerated, dateKey, old, 'hard', now)!.nextState;
    expect(completeListening(answered, dateKey, old.id, 'again')).toBe(answered);
    expect(undoListening(answered, dateKey, old.id, 'easy')).toBe(answered);
  });

  it('recomputes FSRS cleanly on mid-session Tebak Kata re-rating across multiple cards and preserves roundtrip state', () => {
    const subset = cards.slice(0, 3);
    const earlier = new Date(2026, 10, 5, 9);
    let state = applyCardReview(createInitialAppState(), old, 'good', earlier).nextState;
    const oldBaseline = { ...state.progress[old.id] };
    state.settings.dailyNewLimit = 5;

    const initial = getDailyStudy(state, subset, now);
    state = { ...state, dailyStudy: initial.plan };
    for (const card of initial.listeningCards) {
      state = completeListening(state, dateKey, card.id, 'good');
    }

    const [cardA, cardB] = newCards.slice(0, 2);
    state = completeStudyAnswer(state, dateKey, cardA, 'again', now)!.nextState;
    state = completeStudyAnswer(state, dateKey, cardB, 'easy', now)!.nextState;
    state = completeStudyAnswer(state, dateKey, old, 'hard', now)!.nextState;

    const cardBProgressBefore = { ...state.progress[cardB.id] };
    const cardBHistoryBefore = state.reviewHistory.find((entry) => entry.cardId === cardB.id);

    // Re-rate cardA from 'again' -> 'easy'
    const reratedA = completeStudyAnswer(state, dateKey, cardA, 'easy', now)!.nextState;
    expect(reratedA.dailyActivity[dateKey].reviews).toBe(3);
    expect(reratedA.dailyActivity[dateKey].newStudied).toBe(2);
    expect(reratedA.dailyActivity[dateKey].againCount).toBe(0);
    expect(reratedA.dailyActivity[dateKey].easyCount).toBe(2);
    expect(reratedA.dailyActivity[dateKey].hardCount).toBe(1);
    expect(reratedA.dailyStudy?.answeredRatingsByCard?.[cardA.id]).toBe('easy');
    expect(reratedA.progress[cardA.id]).toEqual(scheduleCardReview(undefined, 'easy', now).nextCard);
    expect(reratedA.reviewHistory).toHaveLength(4);
    expect(reratedA.reviewHistory.filter((entry) => entry.cardId === cardA.id)).toHaveLength(1);
    expect(reratedA.reviewHistory.find((entry) => entry.cardId === cardA.id)?.rating).toBe('easy');

    // Card B stays completely untouched
    expect(reratedA.progress[cardB.id]).toEqual(cardBProgressBefore);
    expect(reratedA.reviewHistory.find((entry) => entry.cardId === cardB.id)).toEqual(cardBHistoryBefore);

    // Re-rate due card `old` from 'hard' -> 'good' using its stored baseline
    const reratedOld = completeStudyAnswer(reratedA, dateKey, old, 'good', now)!.nextState;
    expect(reratedOld.progress[old.id]).toEqual(scheduleCardReview(oldBaseline, 'good', now).nextCard);
    expect(reratedOld.dailyActivity[dateKey].hardCount).toBe(0);
    expect(reratedOld.dailyActivity[dateKey].goodCount).toBe(1);
    expect(reratedOld.reviewHistory.filter((entry) => entry.cardId === old.id && entry.dateKey === dateKey)).toHaveLength(1);
    expect(reratedOld.reviewHistory.find((entry) => entry.cardId === old.id && entry.dateKey === dateKey)?.rating).toBe('good');

    // Roundtrip through JSON + normalizeAppState preserves all session revisit fields
    const roundtripped = normalizeAppState(JSON.parse(JSON.stringify(reratedOld)));
    expect(roundtripped.dailyStudy?.listeningRatingsByCard).toEqual(reratedOld.dailyStudy?.listeningRatingsByCard);
    expect(roundtripped.dailyStudy?.answeredRatingsByCard).toEqual(reratedOld.dailyStudy?.answeredRatingsByCard);
    expect(roundtripped.dailyStudy?.clozeDueIds).toEqual([old.id]);
    expect(roundtripped.dailyStudy?.clozeBaselines?.[cardA.id]).toBeNull();
    expect(roundtripped.dailyStudy?.clozeBaselines?.[old.id]).toEqual(oldBaseline);

    const revisitView = getDailyStudy(roundtripped, subset, now);
    expect(revisitView.listening).toEqual([]);
    expect(revisitView.cloze).toEqual([]);
    expect(revisitView.listeningCards).toEqual([cardA, cardB]);
    expect(revisitView.clozeCards).toEqual([cardA, cardB, old]);
  });

  it('uses paired revision without modifying its FSRS schedule when no new cards remain and supports re-rating practice', () => {
    const earlier = new Date(2026, 10, 24, 9);
    const state = applyCardReview(createInitialAppState(), old, 'good', earlier).nextState;
    const start = getDailyStudy(state, [old], now);
    expect(start.plan.practiceIds).toEqual([old.id]);
    expect(start.listening).toEqual(start.cloze);
    const heard = completeListening({ ...state, dailyStudy: start.plan }, dateKey, old.id, 'good');
    const answer = completeStudyAnswer(heard, dateKey, old, 'again', now)!;
    expect(answer.nextState.progress[old.id]).toEqual(state.progress[old.id]);
    expect(answer.nextState.reviewHistory).toEqual(state.reviewHistory);

    const reratedPractice = completeStudyAnswer(answer.nextState, dateKey, old, 'good', now)!;
    expect(reratedPractice.nextState.dailyActivity[dateKey].practiceCompleted).toBe(1);
    expect(reratedPractice.nextState.dailyActivity[dateKey].practiceRatings?.again).toBe(0);
    expect(reratedPractice.nextState.dailyActivity[dateKey].practiceRatings?.good).toBe(1);
    expect(reratedPractice.nextState.dailyStudy?.answeredRatingsByCard?.[old.id]).toBe('good');

    const stats = calculateProgressStats({ cards: [old], ...reratedPractice.nextState, now });
    expect(stats.currentStreak).toBe(2);
    expect(stats.calendarDays.at(-1)?.practiceCompleted).toBe(1);
    expect(stats.calendarDays.at(-1)?.ratings.again).toBe(0);
    expect(stats.calendarDays.at(-1)?.ratings.good).toBe(1);
    expect(getDailyStudy(reratedPractice.nextState, [old], now).cloze).toEqual([]);
    expect(getDailyStudy(reratedPractice.nextState, [old], now).clozeCards).toEqual([old]);
  });

  it('passes extra cards through Listening and starts a new plan the next day', () => {
    let state = createInitialAppState();
    state.settings.dailyNewLimit = 5;
    const initial = getDailyStudy(state, cards, now);
    state.dailyStudy = initial.plan;
    for (const card of initial.listening) state = completeListening(state, dateKey, card.id, 'good');
    for (const card of initial.cloze) state = completeStudyAnswer(state, dateKey, card, 'good', now)!.nextState;
    const done = getDailyStudy(state, cards, now);
    expect(done.cloze.length).toBe(0);
    expect(done.listeningCards).toHaveLength(5);
    expect(done.clozeCards).toHaveLength(5);
    expect(done.extraCount).toBe(2);
    const extended = getDailyStudy(grantExtraNewCards(state, done.extraCount, now), cards, now);
    expect(extended.listening).toEqual(cards.slice(5));
    expect(extended.listeningCards).toEqual(cards);
    expect(extended.listenedCount).toBe(5);
    const tomorrow = new Date(2026, 10, 26, 9);
    const newDay = getDailyStudy(state, cards, tomorrow);
    expect(newDay.plan.dateKey).toBe(getLocalDateKey(tomorrow));
    expect(newDay.answeredCount).toBe(0);
  });

  it('tracks explicit stage completion and keeps completed due cards before newly added extra cards', () => {
    const earlier = new Date(2026, 10, 5, 9);
    let state = applyCardReview(createInitialAppState(), old, 'good', earlier).nextState;
    state.settings.dailyNewLimit = 5;

    const initial = getDailyStudy(state, cards, now);
    state = { ...state, dailyStudy: initial.plan };
    expect(initial.listeningFinished).toBe(false);
    expect(initial.clozeFinished).toBe(false);

    // Rate all Listening cards without marking stage finished
    for (const card of initial.listening) {
      state = completeListening(state, dateKey, card.id, 'good');
    }
    const ratedAllListening = getDailyStudy(state, cards, now);
    expect(ratedAllListening.listening).toEqual([]);
    expect(ratedAllListening.listeningFinished).toBe(false);

    // Explicitly mark Listening finished
    state = markStageFinished(state, dateKey, 'listening', ratedAllListening.listeningCards.length);
    expect(getDailyStudy(state, cards, now).listeningFinished).toBe(true);

    // Rate all Cloze cards (5 paired + 1 due) without marking stage finished
    for (const card of ratedAllListening.cloze) {
      state = completeStudyAnswer(state, dateKey, card, 'good', now)!.nextState;
    }
    const ratedAllCloze = getDailyStudy(state, cards, now);
    expect(ratedAllCloze.cloze).toEqual([]);
    expect(ratedAllCloze.clozeFinished).toBe(false);

    // Explicitly mark Cloze finished
    state = markStageFinished(state, dateKey, 'cloze', ratedAllCloze.clozeCards.length);
    const finishedBoth = getDailyStudy(state, cards, now);
    expect(finishedBoth.clozeFinished).toBe(true);
    expect(finishedBoth.extraCount).toBe(1);

    // Grant extra card and confirm reopened stages + ordering: [p1..p5, old, p6]
    const extendedState = grantExtraNewCards(state, finishedBoth.extraCount, now);
    const extendedStudy = getDailyStudy(extendedState, cards, now);
    expect(extendedStudy.listeningFinished).toBe(false);
    expect(extendedStudy.clozeFinished).toBe(false);
    expect(extendedStudy.listening).toEqual([newCards[5]]);
    expect(extendedStudy.clozeCards).toEqual([...newCards.slice(0, 5), old, newCards[5]]);
  });

  it('recovers legacy same-day ratings from reviewHistory and keeps missing-baseline cards locked', () => {
    const [cardA, cardB] = newCards;
    let state = applyCardReview(createInitialAppState(), cardA, 'hard', now).nextState;
    state = applyCardReview(state, cardA, 'easy', now).nextState;
    state = applyCardReview(state, cardB, 'good', now).nextState;

    const legacyRaw = {
      ...state,
      dailyStudy: {
        dateKey,
        pairedIds: [cardA.id, cardB.id],
        practiceIds: [],
        listenedIds: [cardA.id, cardB.id],
        answeredIds: [cardA.id, cardB.id],
      },
    };

    const normalized = normalizeAppState(JSON.parse(JSON.stringify(legacyRaw)));
    expect(normalized.dailyStudy?.answeredRatingsByCard).toEqual({
      [cardA.id]: 'easy',
      [cardB.id]: 'good',
    });

    // Attempting to re-rate a legacy non-practice card without clozeBaselines is a safe no-op
    const noOp = completeStudyAnswer(normalized, dateKey, cardA, 'again', now)!;
    expect(noOp.nextState).toBe(normalized);
  });

  it('keeps listeningFinished false for extra +5 cards until listening stage is explicitly finished', () => {
    const pool15 = STARTER_CARDS.filter((card) => card.deckId === STARTER_DECK_IDS.FONDASI).slice(0, 15);
    let state = createInitialAppState();
    state.settings.dailyNewLimit = 10;

    const initial = getDailyStudy(state, pool15, now);
    state = { ...state, dailyStudy: initial.plan };
    for (const card of initial.listening) {
      state = completeListening(state, dateKey, card.id, 'good');
    }
    state = markStageFinished(state, dateKey, 'listening', initial.listeningCards.length);
    for (const card of initial.cloze) {
      state = completeStudyAnswer(state, dateKey, card, 'good', now)!.nextState;
    }
    state = markStageFinished(state, dateKey, 'cloze', initial.clozeCards.length);

    const finishedInitial = getDailyStudy(state, pool15, now);
    expect(finishedInitial.listeningFinished).toBe(true);
    expect(finishedInitial.clozeFinished).toBe(true);
    expect(finishedInitial.extraCount).toBe(5);

    state = grantExtraNewCards(state, finishedInitial.extraCount, now);
    const extended = getDailyStudy(state, pool15, now);
    state = { ...state, dailyStudy: extended.plan };
    expect(extended.listeningCards).toHaveLength(15);
    expect(extended.listening).toHaveLength(5);

    for (const card of extended.listening) {
      state = completeListening(state, dateKey, card.id, 'good');
    }

    const afterExtraListening = getDailyStudy(state, pool15, now);
    expect(afterExtraListening.listening).toEqual([]);
    expect(afterExtraListening.listeningCards).toHaveLength(15);
    expect(afterExtraListening.listeningFinished).toBe(false);
    expect(afterExtraListening.clozeFinished).toBe(false);

    state = markStageFinished(state, dateKey, 'listening', afterExtraListening.listeningCards.length);
    const afterConfirmListening = getDailyStudy(state, pool15, now);
    expect(afterConfirmListening.listeningFinished).toBe(true);
    expect(afterConfirmListening.clozeFinished).toBe(false);
  });

  it('marks both listeningFinished and clozeFinished true for a pure legacy completed same-day save', () => {
    const pool10 = STARTER_CARDS.filter((card) => card.deckId === STARTER_DECK_IDS.FONDASI).slice(0, 10);
    let state = createInitialAppState();
    state.settings.dailyNewLimit = 10;
    for (const card of pool10) {
      state = applyCardReview(state, card, 'good', now).nextState;
    }

    const legacyRaw = {
      ...state,
      dailyStudy: {
        dateKey,
        pairedIds: pool10.map((card) => card.id),
        practiceIds: [],
        listenedIds: pool10.map((card) => card.id),
        answeredIds: pool10.map((card) => card.id),
      },
    };

    const normalized = normalizeAppState(JSON.parse(JSON.stringify(legacyRaw)));
    expect(normalized.dailyStudy?.listeningFinishedCount).toBeUndefined();
    expect(normalized.dailyStudy?.clozeFinishedCount).toBeUndefined();
    expect(normalized.dailyStudy?.listeningRatingsByCard).toBeUndefined();
    expect(normalized.dailyStudy?.clozeBaselines).toBeUndefined();

    const view = getDailyStudy(normalized, pool10, now);
    expect(view.listening).toEqual([]);
    expect(view.cloze).toEqual([]);
    expect(view.listeningFinished).toBe(true);
    expect(view.clozeFinished).toBe(true);
  });

  it('keeps clozeCards order strictly stable when rating extra Tebak Kata cards after completed due cards', () => {
    const pool17 = STARTER_CARDS.filter((card) => card.deckId === STARTER_DECK_IDS.FONDASI).slice(0, 17);
    const [due1, due2, ...rest15] = pool17;
    const paired10 = rest15.slice(0, 10);
    const extra5 = rest15.slice(10, 15);
    const earlier1 = new Date(2026, 10, 5, 9, 0);
    const earlier2 = new Date(2026, 10, 5, 9, 1);

    let state = applyCardReview(createInitialAppState(), due1, 'good', earlier1).nextState;
    state = applyCardReview(state, due2, 'good', earlier2).nextState;
    state.settings.dailyNewLimit = 10;

    const initial = getDailyStudy(state, pool17, now);
    state = { ...state, dailyStudy: initial.plan };
    for (const card of initial.listeningCards) {
      state = completeListening(state, dateKey, card.id, 'good');
    }
    state = markStageFinished(state, dateKey, 'listening', initial.listeningCards.length);

    for (const card of initial.clozeCards) {
      state = completeStudyAnswer(state, dateKey, card, 'good', now)!.nextState;
    }
    state = markStageFinished(state, dateKey, 'cloze', initial.clozeCards.length);

    const beforeExtra = getDailyStudy(state, pool17, now);
    expect(beforeExtra.clozeFinished).toBe(true);
    expect(beforeExtra.extraCount).toBe(5);

    state = grantExtraNewCards(state, beforeExtra.extraCount, now);
    const afterGrant = getDailyStudy(state, pool17, now);
    state = { ...state, dailyStudy: afterGrant.plan };

    for (const card of afterGrant.listening) {
      state = completeListening(state, dateKey, card.id, 'good');
    }
    state = markStageFinished(state, dateKey, 'listening', afterGrant.listeningCards.length);

    const expectedIds = [...paired10, due1, due2, ...extra5].map((card) => card.id);
    const readyForExtraCloze = getDailyStudy(state, pool17, now);
    expect(readyForExtraCloze.clozeCards.map((card) => card.id)).toEqual(expectedIds);
    expect(readyForExtraCloze.cloze.map((card) => card.id)).toEqual(extra5.map((card) => card.id));

    for (let i = 0; i < extra5.length; i += 1) {
      state = completeStudyAnswer(state, dateKey, extra5[i], 'good', now)!.nextState;
      const stepView = getDailyStudy(state, pool17, now);
      expect(stepView.clozeCards.map((card) => card.id)).toEqual(expectedIds);
      expect(stepView.clozeCards.slice(12, 17).map((card) => card.id)).toEqual(extra5.map((card) => card.id));
      expect(stepView.answeredCount).toBe(12 + i + 1);
    }

    state = markStageFinished(state, dateKey, 'cloze', expectedIds.length);
    const completedView = getDailyStudy(state, pool17, now);
    expect(completedView.clozeFinished).toBe(true);
    expect(completedView.cloze).toEqual([]);
    expect(completedView.clozeCards.map((card) => card.id)).toEqual(expectedIds);

    const reopened = getDailyStudy(normalizeAppState(JSON.parse(JSON.stringify(state))), pool17, now);
    expect(reopened.clozeCards.map((card) => card.id)).toEqual(expectedIds);
  });
});

describe('Kalimat pasangan', () => {
  it('matches the same spelled target in 200 distinct starter pairs', () => {
    expect(STARTER_CARDS).toHaveLength(200);
    for (const card of STARTER_CARDS) {
      const { answer, listening, cloze, hasAlternate } = getStudySentences(card);
      expect(card.sentenceTranslationId?.trim(), card.id).toBeTruthy();
      expect(hasAlternate, card.id).toBe(true);
      expect(cloze.cleanSentence, card.id).not.toBe(listening.cleanSentence);
      for (const example of [listening, cloze]) {
        expect(example.hasMatch, card.id).toBe(true);
        for (const segment of example.segments.filter((part) => part.type === 'cloze')) {
          expect(normalizeStudyAnswer(segment.value), card.id).toBe(normalizeStudyAnswer(answer));
        }
      }
    }
  });

  it('accepts an imported alternative only when the same form appears', () => {
    const input = 'phrase,sentence,practiceSentence,sentenceTranslationId\npostpone,We need to postpone the meeting.,Can we postpone the call?,Kita perlu menunda rapat.\nbook,Please book a table.,I already booked one.,Tolong pesan meja.';
    const { cards: imported, warnings } = parseVocabImport(input, { deckId: 'imported', defaultCefr: 'B1' });
    expect(getStudySentences(imported[0]).cloze.cleanSentence).toBe('Can we postpone the call?');
    expect(imported[0].sentenceTranslationId).toBe('Kita perlu menunda rapat.');
    expect(getStudySentences(imported[1]).cloze.cleanSentence).toBe('Please book a table.');
    expect(warnings).toHaveLength(1);
    expect(normalizeStudyAnswer('  DON’T   GIVE UP  ')).toBe("don't give up");
  });
});
