import { getEmptyDailyActivity, getLocalDateKey } from '../storage/state';
import type {
  AppState,
  DailyStudy,
  ReviewRatingKey,
  StoredFsrsCard,
  StudyStage,
  VocabCard,
} from '../types';
import { applyCardReview, buildDailyQueue, classifyMastery, scheduleCardReview } from './engine';

const RATING_COUNT_KEYS: Record<
  ReviewRatingKey,
  'againCount' | 'hardCount' | 'goodCount' | 'easyCount'
> = {
  again: 'againCount',
  hard: 'hardCount',
  good: 'goodCount',
  easy: 'easyCount',
};

function updateReviewHistoryRating(
  history: AppState['reviewHistory'],
  cardId: string,
  dateKey: string,
  rating: ReviewRatingKey,
  now: Date
) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.cardId === cardId && entry.dateKey === dateKey) {
      const nextHistory = [...history];
      nextHistory[i] = {
        ...entry,
        rating,
        reviewedAt: now.toISOString(),
      };
      return nextHistory;
    }
  }
  return history;
}

export function getDailyStudy(state: AppState, cards: VocabCard[], now: Date) {
  const dateKey = getLocalDateKey(now);
  const saved = state.dailyStudy?.dateKey === dateKey ? state.dailyStudy : undefined;
  const plan: DailyStudy = saved ?? {
    dateKey,
    pairedIds: [],
    practiceIds: [],
    listenedIds: [],
    answeredIds: [],
  };
  const queue = buildDailyQueue({
    cards,
    progress: state.progress,
    activeDeckIds: state.settings.activeDeckIds,
    dailyNewLimit: state.settings.dailyNewLimit,
    dailyActivity: state.dailyActivity,
    now,
  });
  const byId = new Map(cards.map((card) => [card.id, card]));
  const answered = new Set(plan.answeredIds);
  const heard = new Set(plan.listenedIds);
  const reserved = new Set(plan.pairedIds);
  const paired = plan.pairedIds.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
  const due = queue.dueCards.filter((card) => !answered.has(card.id) && !reserved.has(card.id));

  if (paired.every((card) => answered.has(card.id))) {
    const additions = queue.newCards.filter((card) => !reserved.has(card.id));
    if (additions.length) {
      paired.push(...additions);
    } else if (!saved) {
      const dueIds = new Set(due.map((card) => card.id));
      const active = new Set(state.settings.activeDeckIds);
      const practice = cards.filter((card) => {
        const progress = state.progress[card.id];
        return active.has(card.deckId) && !dueIds.has(card.id) &&
          classifyMastery(progress) !== 'new' &&
          (!progress?.last_review || getLocalDateKey(new Date(progress.last_review)) !== dateKey);
      }).slice(0, 5);
      paired.push(...practice);
      plan.practiceIds = practice.map((card) => card.id);
    }
  }

  const answeredCards = plan.answeredIds.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
  const seenClozeIds = new Set(answeredCards.map((card) => card.id));
  const pendingPaired = paired.filter((card) => !seenClozeIds.has(card.id));
  for (const card of pendingPaired) seenClozeIds.add(card.id);
  const remainingDueCards = due.filter((card) => !seenClozeIds.has(card.id));

  const listeningCards = [...paired];
  const clozeCards = [
    ...answeredCards,
    ...pendingPaired,
    ...remainingDueCards,
  ];
  const listening = paired.filter((card) => !heard.has(card.id) && !answered.has(card.id));
  const cloze = [...pendingPaired, ...remainingDueCards];
  const legacyListeningFinished =
    plan.listeningFinishedCount === undefined &&
    plan.listeningRatingsByCard === undefined &&
    plan.answeredIds.length > 0;
  const listeningFinished =
    listeningCards.length > 0 &&
    listening.length === 0 &&
    (legacyListeningFinished || (plan.listeningFinishedCount ?? 0) >= listeningCards.length);
  const legacyClozeFinished =
    plan.clozeFinishedCount === undefined &&
    plan.clozeBaselines === undefined &&
    plan.answeredIds.length > 0;
  const clozeFinished =
    clozeCards.length > 0 &&
    cloze.length === 0 &&
    (legacyClozeFinished || (plan.clozeFinishedCount ?? 0) >= clozeCards.length);

  return {
    plan: { ...plan, pairedIds: paired.map((card) => card.id) },
    listeningCards,
    clozeCards,
    listening,
    cloze,
    listeningFinished,
    clozeFinished,
    dueCount: due.length,
    listenedCount: paired.length - listening.length,
    answeredCount: answeredCards.length,
    newStudiedToday: queue.newStudiedToday,
    totalNewQuotaToday: queue.totalNewQuotaToday,
    extraCount: Math.min(5, queue.availableExtraNewCount),
  };
}

export type DailyStudyView = ReturnType<typeof getDailyStudy>;

export function markStageFinished(
  state: AppState,
  dateKey: string,
  stage: StudyStage,
  totalCards: number,
): AppState {
  const plan = state.dailyStudy;
  if (!plan || plan.dateKey !== dateKey) return state;

  const safeTotal = Math.max(0, Math.floor(totalCards));
  if (stage === 'listening') {
    const nextCount = Math.max(plan.listeningFinishedCount ?? 0, safeTotal);
    if (plan.listeningFinishedCount === nextCount) return state;
    return {
      ...state,
      dailyStudy: {
        ...plan,
        listeningFinishedCount: nextCount,
      },
    };
  }

  const nextCount = Math.max(plan.clozeFinishedCount ?? 0, safeTotal);
  if (plan.clozeFinishedCount === nextCount) return state;
  return {
    ...state,
    dailyStudy: {
      ...plan,
      clozeFinishedCount: nextCount,
    },
  };
}

export function completeListening(
  state: AppState,
  dateKey: string,
  cardId: string,
  rating: ReviewRatingKey,
): AppState {
  const plan = state.dailyStudy;
  if (!plan || plan.dateKey !== dateKey || !plan.pairedIds.includes(cardId) ||
      plan.answeredIds.includes(cardId)) return state;

  const activity = state.dailyActivity[dateKey] ?? getEmptyDailyActivity(dateKey);
  const alreadyListened = plan.listenedIds.includes(cardId);

  if (!alreadyListened) {
    return {
      ...state,
      dailyStudy: {
        ...plan,
        listenedIds: [...plan.listenedIds, cardId],
        listeningRatingsByCard: {
          ...plan.listeningRatingsByCard,
          [cardId]: rating,
        },
      },
      dailyActivity: {
        ...state.dailyActivity,
        [dateKey]: {
          ...activity,
          listeningRatings: {
            ...activity.listeningRatings,
            [rating]: (activity.listeningRatings?.[rating] ?? 0) + 1,
          },
        },
      },
    };
  }

  const prevRating = plan.listeningRatingsByCard?.[cardId];
  if (!prevRating || prevRating === rating) return state;

  return {
    ...state,
    dailyStudy: {
      ...plan,
      listeningRatingsByCard: {
        ...plan.listeningRatingsByCard,
        [cardId]: rating,
      },
    },
    dailyActivity: {
      ...state.dailyActivity,
      [dateKey]: {
        ...activity,
        listeningRatings: {
          ...activity.listeningRatings,
          [prevRating]: Math.max(0, (activity.listeningRatings?.[prevRating] ?? 0) - 1),
          [rating]: (activity.listeningRatings?.[rating] ?? 0) + 1,
        },
      },
    },
  };
}

export function undoListening(state: AppState, dateKey: string, cardId: string, rating: ReviewRatingKey): AppState {
  const plan = state.dailyStudy;
  const activity = state.dailyActivity[dateKey];
  const count = activity?.listeningRatings?.[rating] ?? 0;
  if (!plan || plan.dateKey !== dateKey || !activity || count <= 0 ||
      !plan.listenedIds.includes(cardId) || plan.answeredIds.includes(cardId)) return state;

  const nextRatingsByCard = plan.listeningRatingsByCard ? { ...plan.listeningRatingsByCard } : undefined;
  if (nextRatingsByCard) delete nextRatingsByCard[cardId];

  return {
    ...state,
    dailyStudy: {
      ...plan,
      listenedIds: plan.listenedIds.filter((id) => id !== cardId),
      ...(nextRatingsByCard ? { listeningRatingsByCard: nextRatingsByCard } : {}),
    },
    dailyActivity: {
      ...state.dailyActivity,
      [dateKey]: {
        ...activity,
        listeningRatings: { ...activity.listeningRatings, [rating]: count - 1 },
      },
    },
  };
}

export function completeStudyAnswer(
  state: AppState,
  dateKey: string,
  card: VocabCard,
  rating: ReviewRatingKey,
  now: Date,
) {
  const plan = state.dailyStudy;
  if (!plan || plan.dateKey !== dateKey) return null;
  if (plan.pairedIds.some((id) => !plan.listenedIds.includes(id) && !plan.answeredIds.includes(id))) return null;

  const isPractice = plan.practiceIds.includes(card.id);
  const alreadyAnswered = plan.answeredIds.includes(card.id);

  if (!alreadyAnswered) {
    const baseline: StoredFsrsCard | null = state.progress[card.id]
      ? { ...state.progress[card.id] }
      : null;
    const result = isPractice ? null : applyCardReview(state, card, rating, now);
    const activity = state.dailyActivity[dateKey] ?? getEmptyDailyActivity(dateKey);
    const nextState = result?.nextState ?? {
      ...state,
      dailyActivity: {
        ...state.dailyActivity,
        [dateKey]: {
          ...activity,
          practiceCompleted: (activity.practiceCompleted ?? 0) + 1,
          practiceRatings: {
            ...activity.practiceRatings,
            [rating]: (activity.practiceRatings?.[rating] ?? 0) + 1,
          },
        },
      },
    };
    const isDue = !plan.pairedIds.includes(card.id);
    const nextDueIds = isDue
      ? [...new Set([...(plan.clozeDueIds ?? []), card.id])]
      : plan.clozeDueIds;

    return {
      nextState: {
        ...nextState,
        dailyStudy: {
          ...plan,
          answeredIds: [...plan.answeredIds, card.id],
          answeredRatingsByCard: {
            ...plan.answeredRatingsByCard,
            [card.id]: rating,
          },
          ...(nextDueIds ? { clozeDueIds: nextDueIds } : {}),
          clozeBaselines: {
            ...plan.clozeBaselines,
            [card.id]: baseline,
          },
        },
      },
      undoSnapshot: result?.undoSnapshot,
    };
  }

  const prevRating = plan.answeredRatingsByCard?.[card.id];
  if (
    !prevRating ||
    prevRating === rating ||
    (!isPractice &&
      !(plan.clozeBaselines && Object.prototype.hasOwnProperty.call(plan.clozeBaselines, card.id)))
  ) {
    return { nextState: state, undoSnapshot: undefined };
  }

  const activity = state.dailyActivity[dateKey] ?? getEmptyDailyActivity(dateKey);
  const nextDailyStudy: DailyStudy = {
    ...plan,
    answeredRatingsByCard: {
      ...plan.answeredRatingsByCard,
      [card.id]: rating,
    },
  };

  if (isPractice) {
    return {
      nextState: {
        ...state,
        dailyActivity: {
          ...state.dailyActivity,
          [dateKey]: {
            ...activity,
            practiceRatings: {
              ...activity.practiceRatings,
              [prevRating]: Math.max(0, (activity.practiceRatings?.[prevRating] ?? 0) - 1),
              [rating]: (activity.practiceRatings?.[rating] ?? 0) + 1,
            },
          },
        },
        dailyStudy: nextDailyStudy,
      },
      undoSnapshot: undefined,
    };
  }

  const baseline = plan.clozeBaselines?.[card.id] ?? undefined;
  const { nextCard } = scheduleCardReview(baseline, rating, now);
  const prevCountKey = RATING_COUNT_KEYS[prevRating];
  const nextCountKey = RATING_COUNT_KEYS[rating];

  return {
    nextState: {
      ...state,
      progress: {
        ...state.progress,
        [card.id]: nextCard,
      },
      dailyActivity: {
        ...state.dailyActivity,
        [dateKey]: {
          ...activity,
          [prevCountKey]: Math.max(0, activity[prevCountKey] - 1),
          [nextCountKey]: activity[nextCountKey] + 1,
        },
      },
      reviewHistory: updateReviewHistoryRating(state.reviewHistory, card.id, dateKey, rating, now),
      dailyStudy: nextDailyStudy,
    },
    undoSnapshot: undefined,
  };
}
