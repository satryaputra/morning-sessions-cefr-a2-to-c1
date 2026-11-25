import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import {
  applyCardReview,
  buildDailyQueue,
  calculateProgressStats,
  classifyMastery,
  formatIntervalId,
  grantExtraNewCards,
  previewRatingOptions,
  scheduleCardReview,
  undoCardReview,
} from './engine';
import { createInitialAppState, getLocalDateKey } from '../storage/state';
import { STARTER_CARDS, STARTER_DECK_IDS } from '../data';
import type { VocabCard } from '../types';

const sampleCard: VocabCard = STARTER_CARDS[0];

describe('SRS Engine (ts-fsrs)', () => {
  it('generates 4 human-friendly rating previews with monotonically non-decreasing intervals', () => {
    const now = new Date('2026-06-01T07:30:00.000Z');
    const options = previewRatingOptions(undefined, now);

    expect(options.map((o) => o.label)).toEqual(['Baru', 'Susah', 'Biasa', 'Mudah']);
    expect(options.map((o) => o.shortcut)).toEqual(['1', '2', '3', '4']);
    expect(options[0].nextDue.getTime()).toBeLessThanOrEqual(options[1].nextDue.getTime());
    expect(options[1].nextDue.getTime()).toBeLessThanOrEqual(options[2].nextDue.getTime());
    expect(options[2].nextDue.getTime()).toBeLessThanOrEqual(options[3].nextDue.getTime());
  });

  it('schedules a first failed answer tomorrow and a first correct answer later', () => {
    const now = new Date('2026-06-01T07:30:00.000Z');
    const againResult = scheduleCardReview(undefined, 'again', now);
    expect(againResult.nextCard.reps).toBe(1);
    expect(new Date(againResult.nextCard.due).getTime()).toBe(now.getTime() + 86_400_000);

    const goodResult = scheduleCardReview(undefined, 'good', now);
    expect(new Date(goodResult.nextCard.due).getTime()).toBeGreaterThan(now.getTime() + 86_400_000);

    const easyResult = scheduleCardReview(undefined, 'easy', now);
    expect(easyResult.nextCard.state).toBe(State.Review);
    expect(new Date(easyResult.nextCard.due).getTime()).toBeGreaterThan(now.getTime() + 86_400_000);
  });

  it('applies review and completely restores previous state on Undo', () => {
    const initial = createInitialAppState();
    const now = new Date('2026-06-01T07:30:00.000Z');
    const dateKey = getLocalDateKey(now);

    const { nextState, undoSnapshot } = applyCardReview(initial, sampleCard, 'good', now);

    expect(nextState.progress[sampleCard.id]).toBeDefined();
    expect(nextState.progress[sampleCard.id].reps).toBe(1);
    expect(nextState.dailyActivity[dateKey].reviews).toBe(1);
    expect(nextState.dailyActivity[dateKey].newStudied).toBe(1);
    expect(nextState.reviewHistory).toHaveLength(1);

    const restored = undoCardReview(nextState, undoSnapshot);
    expect(restored.progress[sampleCard.id]).toBeUndefined();
    expect(restored.dailyActivity[dateKey]).toBeUndefined();
    expect(restored.reviewHistory).toHaveLength(0);
  });

  it('restores prior progress accurately when undoing a second review on an existing card', () => {
    const initial = createInitialAppState();
    const t1 = new Date('2026-06-01T07:30:00.000Z');
    const t2 = new Date('2026-06-02T07:30:00.000Z');

    const first = applyCardReview(initial, sampleCard, 'easy', t1);
    const second = applyCardReview(first.nextState, sampleCard, 'again', t2);

    expect(second.nextState.progress[sampleCard.id].lapses).toBeGreaterThanOrEqual(1);

    const undone = undoCardReview(second.nextState, second.undoSnapshot);
    expect(undone.progress[sampleCard.id]).toEqual(first.nextState.progress[sampleCard.id]);
    expect(undone.reviewHistory).toHaveLength(1);
  });

  it('builds daily queue combining overdue cards first, respecting active decks and daily new limit + extra cards', () => {
    const now = new Date('2026-06-05T08:00:00.000Z');
    const fondasiCards = STARTER_CARDS.filter((c) => c.deckId === STARTER_DECK_IDS.FONDASI);
    const c1Cards = STARTER_CARDS.filter((c) => c.deckId === STARTER_DECK_IDS.OXFORD_C1);

    const state = createInitialAppState();
    // Put 2 Fondasi cards as due and 1 C1 card as due (C1 deck inactive)
    const pastDue = new Date('2026-06-04T08:00:00.000Z').toISOString();
    state.progress[fondasiCards[0].id] = {
      due: pastDue,
      stability: 5,
      difficulty: 5,
      elapsed_days: 2,
      scheduled_days: 3,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: State.Review,
      last_review: new Date('2026-06-01T08:00:00.000Z').toISOString(),
    };
    state.progress[fondasiCards[1].id] = {
      due: new Date('2026-06-05T07:55:00.000Z').toISOString(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 1,
      reps: 1,
      lapses: 0,
      state: State.Learning,
      last_review: new Date('2026-06-05T07:45:00.000Z').toISOString(),
    };
    state.progress[c1Cards[0].id] = {
      due: pastDue,
      stability: 5,
      difficulty: 5,
      elapsed_days: 2,
      scheduled_days: 3,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      state: State.Review,
    };

    const queue = buildDailyQueue({
      cards: STARTER_CARDS,
      progress: state.progress,
      activeDeckIds: [STARTER_DECK_IDS.FONDASI],
      dailyNewLimit: 5,
      dailyActivity: state.dailyActivity,
      now,
    });

    expect(queue.dueCount).toBe(2);
    expect(queue.newCount).toBe(5);
    expect(queue.totalCount).toBe(7);
    // Learning card comes before review card
    expect(queue.queue[0].id).toBe(fondasiCards[1].id);
    expect(queue.queue[1].id).toBe(fondasiCards[0].id);
    // Inactive deck excluded
    expect(queue.queue.some((c) => c.deckId === STARTER_DECK_IDS.OXFORD_C1)).toBe(false);

    // Grant 5 extra cards
    const stateWithExtra = grantExtraNewCards(state, 5, now);
    const expandedQueue = buildDailyQueue({
      cards: STARTER_CARDS,
      progress: stateWithExtra.progress,
      activeDeckIds: [STARTER_DECK_IDS.FONDASI],
      dailyNewLimit: 5,
      dailyActivity: stateWithExtra.dailyActivity,
      now,
    });

    expect(expandedQueue.newCount).toBe(10);
    expect(expandedQueue.totalCount).toBe(12);
  });

  it('classifies mastery buckets and computes streaks and Indonesian intervals', () => {
    const now = new Date('2026-06-10T08:00:00.000Z');
    expect(classifyMastery(undefined)).toBe('new');
    expect(
      classifyMastery({
        due: now.toISOString(),
        stability: 1.5,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 1,
        reps: 1,
        lapses: 0,
        state: State.Learning,
      })
    ).toBe('learning');
    expect(
      classifyMastery({
        due: now.toISOString(),
        stability: 12,
        difficulty: 5,
        elapsed_days: 4,
        scheduled_days: 10,
        learning_steps: 0,
        reps: 4,
        lapses: 0,
        state: State.Review,
      })
    ).toBe('mastering');
    expect(
      classifyMastery({
        due: now.toISOString(),
        stability: 30,
        difficulty: 4,
        elapsed_days: 15,
        scheduled_days: 28,
        learning_steps: 0,
        reps: 6,
        lapses: 0,
        state: State.Review,
      })
    ).toBe('memorized');

    expect(formatIntervalId(new Date(now.getTime() + 10 * 60_000), now)).toBe('10 mnt');
    expect(formatIntervalId(new Date(now.getTime() + 4 * 86_400_000), now)).toBe('4 hari');
    expect(formatIntervalId(new Date(now.getTime() + 21 * 86_400_000), now)).toBe('3 minggu');

    const stats = calculateProgressStats({
      cards: STARTER_CARDS.slice(0, 10),
      progress: {},
      dailyActivity: {
        '2026-06-08': {
          dateKey: '2026-06-08',
          reviews: 12,
          newStudied: 5,
          againCount: 1,
          hardCount: 2,
          goodCount: 7,
          easyCount: 2,
          extraNewGranted: 0,
        },
        '2026-06-09': {
          dateKey: '2026-06-09',
          reviews: 10,
          newStudied: 5,
          againCount: 0,
          hardCount: 1,
          goodCount: 8,
          easyCount: 1,
          extraNewGranted: 0,
        },
        '2026-06-10': {
          dateKey: '2026-06-10',
          reviews: 8,
          newStudied: 3,
          againCount: 1,
          hardCount: 1,
          goodCount: 5,
          easyCount: 1,
          extraNewGranted: 0,
        },
      },
      now,
    });

    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.totalReviews).toBe(30);
    expect(stats.retentionRate).toBe(93);
    expect(stats.calendarDays).toHaveLength(28);
  });
});
