import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from 'ts-fsrs';
import type {
  AppState,
  CefrLevel,
  DailyActivity,
  MasteryBucket,
  ReviewLogEntry,
  ReviewRatingKey,
  StoredFsrsCard,
  VocabCard,
} from '../types';
import { getEmptyDailyActivity, getLocalDateKey } from '../storage/state';

const fsrsParams = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: false,
  enable_short_term: true,
});

const scheduler = fsrs(fsrsParams);

export const RATING_MAP: Record<ReviewRatingKey, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export interface RatingOptionMeta {
  key: ReviewRatingKey;
  label: string;
  shortcut: '1' | '2' | '3' | '4';
  intervalLabel: string;
  nextDue: Date;
}

export interface DailyQueueResult {
  dueCards: VocabCard[];
  newCards: VocabCard[];
  queue: VocabCard[];
  dueCount: number;
  newCount: number;
  totalCount: number;
  remainingNewQuota: number;
  totalNewQuotaToday: number;
  newStudiedToday: number;
  reviewsToday: number;
  estimatedMinutes: number;
  availableExtraNewCount: number;
}

export interface UndoSnapshot {
  cardId: string;
  previousProgress: StoredFsrsCard | undefined;
  dateKey: string;
  previousDailyActivity: DailyActivity | undefined;
  reviewLogId: string;
}

export interface ActivityDayCell {
  dateKey: string;
  label: string;
  shortDay: string;
  reviews: number;
  newStudied: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
}

export interface CefrProgressStat {
  level: CefrLevel;
  total: number;
  started: number;
  mastered: number;
  percentStarted: number;
  percentMastered: number;
}

export interface ProgressStats {
  totalCards: number;
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  reviewsToday: number;
  retentionRate: number | null;
  masteryCounts: Record<MasteryBucket, number>;
  cefrBreakdown: CefrProgressStat[];
  calendarDays: ActivityDayCell[];
}

export function hydrateFsrsCard(stored: StoredFsrsCard | undefined, now: Date = new Date()): Card {
  if (!stored) {
    return createEmptyCard(now);
  }
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps ?? 0,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as State,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

export function serializeFsrsCard(card: Card): StoredFsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : undefined,
  };
}

/**
 * Formats the interval between `now` and `nextDue` into friendly concise Indonesian labels.
 */
export function formatIntervalId(nextDue: Date, now: Date): string {
  const diffMs = Math.max(0, nextDue.getTime() - now.getTime());
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return '< 1 mnt';
  if (minutes < 60) return `${minutes} mnt`;

  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return `${hours} jam`;

  const days = Math.round(diffMs / 86_400_000);
  if (days < 14) return `${days} hari`;

  if (days < 45) {
    const weeks = Math.round(days / 7);
    return `${weeks} minggu`;
  }

  if (days < 365) {
    const months = Math.round((days / 30) * 10) / 10;
    const formatted = Number.isInteger(months)
      ? String(months)
      : months.toFixed(1).replace('.', ',');
    return `${formatted} bln`;
  }

  const years = Math.round((days / 365) * 10) / 10;
  const formatted = Number.isInteger(years) ? String(years) : years.toFixed(1).replace('.', ',');
  return `${formatted} thn`;
}

/**
 * Computes next interval preview for all 4 human-friendly rating buttons using ts-fsrs.
 */
export function previewRatingOptions(
  stored: StoredFsrsCard | undefined,
  now: Date = new Date()
): RatingOptionMeta[] {
  const card = hydrateFsrsCard(stored, now);
  const preview = scheduler.repeat(card, now);

  const defs: Array<{ key: ReviewRatingKey; label: string; shortcut: '1' | '2' | '3' | '4' }> = [
    { key: 'again', label: 'Lupa', shortcut: '1' },
    { key: 'hard', label: 'Susah', shortcut: '2' },
    { key: 'good', label: 'Ingat', shortcut: '3' },
    { key: 'easy', label: 'Mudah', shortcut: '4' },
  ];

  return defs.map((def) => {
    const nextCard = preview[RATING_MAP[def.key]].card;
    return {
      key: def.key,
      label: def.label,
      shortcut: def.shortcut,
      intervalLabel: formatIntervalId(nextCard.due, now),
      nextDue: nextCard.due,
    };
  });
}

/**
 * Rates a card using ts-fsrs and indicates whether it should be re-queued in the active session
 * (e.g., short intra-day learning/relearning step <= 30 minutes).
 */
export function scheduleCardReview(
  stored: StoredFsrsCard | undefined,
  ratingKey: ReviewRatingKey,
  now: Date = new Date()
): {
  nextCard: StoredFsrsCard;
  shouldRequeueInSession: boolean;
  intervalLabel: string;
} {
  const card = hydrateFsrsCard(stored, now);
  const result = scheduler.next(card, now, RATING_MAP[ratingKey]);
  const serialized = serializeFsrsCard(result.card);
  const diffMinutes = (result.card.due.getTime() - now.getTime()) / 60_000;
  const isLearningState =
    result.card.state === State.Learning || result.card.state === State.Relearning;
  const shouldRequeueInSession = isLearningState && diffMinutes <= 30;

  return {
    nextCard: serialized,
    shouldRequeueInSession,
    intervalLabel: formatIntervalId(result.card.due, now),
  };
}

/**
 * Classifies a card into 4 friendly Indonesian mastery stages.
 */
export function classifyMastery(stored: StoredFsrsCard | undefined): MasteryBucket {
  if (!stored || stored.state === State.New || stored.reps === 0) {
    return 'new';
  }
  if (stored.state === State.Learning || stored.state === State.Relearning) {
    return 'learning';
  }
  const strengthDays = Math.max(stored.scheduled_days, stored.stability);
  if (strengthDays >= 21) {
    return 'memorized';
  }
  if (strengthDays >= 7) {
    return 'mastering';
  }
  return 'learning';
}

export const MASTERY_LABELS: Record<MasteryBucket, string> = {
  new: 'Baru',
  learning: 'Belajar',
  mastering: 'Menguasai',
  memorized: 'Hafal',
};

/**
 * Builds today's morning review queue:
 * - Due / Learning / Relearning cards from active decks
 * - Up to remaining daily new-card quota (including any extra cards granted today)
 */
export function buildDailyQueue(params: {
  cards: VocabCard[];
  progress: Record<string, StoredFsrsCard>;
  activeDeckIds: string[];
  dailyNewLimit: number;
  dailyActivity: Record<string, DailyActivity>;
  now?: Date;
}): DailyQueueResult {
  const now = params.now ?? new Date();
  const dateKey = getLocalDateKey(now);
  const today = params.dailyActivity[dateKey] ?? getEmptyDailyActivity(dateKey);
  const activeSet = new Set(params.activeDeckIds);
  const activeCards = params.cards.filter((card) => activeSet.has(card.deckId));

  // Treat learning cards due within the next 20 minutes as immediately reviewable in today's session
  const learningCutoffMs = now.getTime() + 20 * 60_000;
  const nowMs = now.getTime();

  const dueWithPriority: Array<{ card: VocabCard; isLearning: boolean; dueMs: number }> = [];
  const unseenPool: VocabCard[] = [];

  for (const card of activeCards) {
    const stored = params.progress[card.id];
    if (!stored || stored.state === State.New || stored.reps === 0) {
      unseenPool.push(card);
      continue;
    }

    const dueMs = new Date(stored.due).getTime();
    const isLearning = stored.state === State.Learning || stored.state === State.Relearning;
    if ((isLearning && dueMs <= learningCutoffMs) || dueMs <= nowMs) {
      dueWithPriority.push({ card, isLearning, dueMs });
    }
  }

  dueWithPriority.sort((a, b) => {
    if (a.isLearning !== b.isLearning) return a.isLearning ? -1 : 1;
    return a.dueMs - b.dueMs;
  });

  const dueCards = dueWithPriority.map((item) => item.card);
  const totalNewQuotaToday = params.dailyNewLimit + today.extraNewGranted;
  const remainingNewQuota = Math.max(0, totalNewQuotaToday - today.newStudied);
  const newCards = unseenPool.slice(0, remainingNewQuota);
  const availableExtraNewCount = Math.max(0, unseenPool.length - newCards.length);

  // Interleave lightly: start with due cards so yesterday's memory gets reinforced first, then new cards
  const queue = [...dueCards, ...newCards];
  const totalCount = queue.length;
  const estimatedMinutes =
    totalCount === 0 ? 0 : Math.max(1, Math.round((dueCards.length * 18 + newCards.length * 32) / 60));

  return {
    dueCards,
    newCards,
    queue,
    dueCount: dueCards.length,
    newCount: newCards.length,
    totalCount,
    remainingNewQuota,
    totalNewQuotaToday,
    newStudiedToday: today.newStudied,
    reviewsToday: today.reviews,
    estimatedMinutes,
    availableExtraNewCount,
  };
}

/**
 * Pure state transition that applies a card rating and returns both next AppState and UndoSnapshot.
 */
export function applyCardReview(
  state: AppState,
  card: VocabCard,
  ratingKey: ReviewRatingKey,
  now: Date = new Date()
): {
  nextState: AppState;
  undoSnapshot: UndoSnapshot;
  shouldRequeueInSession: boolean;
  intervalLabel: string;
} {
  const dateKey = getLocalDateKey(now);
  const previousProgress = state.progress[card.id];
  const wasNew = !previousProgress || previousProgress.state === State.New || previousProgress.reps === 0;

  const { nextCard, shouldRequeueInSession, intervalLabel } = scheduleCardReview(
    previousProgress,
    ratingKey,
    now
  );

  const previousDaily = state.dailyActivity[dateKey];
  const baseDaily = previousDaily ? { ...previousDaily } : getEmptyDailyActivity(dateKey);

  baseDaily.reviews += 1;
  if (wasNew) baseDaily.newStudied += 1;
  if (ratingKey === 'again') baseDaily.againCount += 1;
  if (ratingKey === 'hard') baseDaily.hardCount += 1;
  if (ratingKey === 'good') baseDaily.goodCount += 1;
  if (ratingKey === 'easy') baseDaily.easyCount += 1;

  const reviewLogId = `rev-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
  const logEntry: ReviewLogEntry = {
    id: reviewLogId,
    cardId: card.id,
    deckId: card.deckId,
    rating: ratingKey,
    reviewedAt: now.toISOString(),
    dateKey,
    wasNew,
  };

  const nextState: AppState = {
    ...state,
    progress: {
      ...state.progress,
      [card.id]: nextCard,
    },
    dailyActivity: {
      ...state.dailyActivity,
      [dateKey]: baseDaily,
    },
    reviewHistory: [...state.reviewHistory.slice(-1999), logEntry],
  };

  return {
    nextState,
    undoSnapshot: {
      cardId: card.id,
      previousProgress: previousProgress ? { ...previousProgress } : undefined,
      dateKey,
      previousDailyActivity: previousDaily ? { ...previousDaily } : undefined,
      reviewLogId,
    },
    shouldRequeueInSession,
    intervalLabel,
  };
}

/**
 * Pure state transition that cleanly rolls back the last rating using an UndoSnapshot.
 */
export function undoCardReview(state: AppState, snapshot: UndoSnapshot): AppState {
  const nextProgress = { ...state.progress };
  if (snapshot.previousProgress) {
    nextProgress[snapshot.cardId] = { ...snapshot.previousProgress };
  } else {
    delete nextProgress[snapshot.cardId];
  }

  const nextDailyActivity = { ...state.dailyActivity };
  if (snapshot.previousDailyActivity) {
    nextDailyActivity[snapshot.dateKey] = { ...snapshot.previousDailyActivity };
  } else {
    delete nextDailyActivity[snapshot.dateKey];
  }

  return {
    ...state,
    progress: nextProgress,
    dailyActivity: nextDailyActivity,
    reviewHistory: state.reviewHistory.filter((entry) => entry.id !== snapshot.reviewLogId),
  };
}

/**
 * Grants extra new cards for today (e.g. "+5 Kartu Ekstra") when daily session finishes.
 */
export function grantExtraNewCards(
  state: AppState,
  extraCount: number = 5,
  now: Date = new Date()
): AppState {
  const dateKey = getLocalDateKey(now);
  const current = state.dailyActivity[dateKey] ?? getEmptyDailyActivity(dateKey);

  return {
    ...state,
    dailyActivity: {
      ...state.dailyActivity,
      [dateKey]: {
        ...current,
        extraNewGranted: current.extraNewGranted + extraCount,
      },
    },
  };
}

function shiftDateKey(base: Date, offsetDays: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + offsetDays);
  return d;
}

const SHORT_DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const SHORT_MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function calculateProgressStats(params: {
  cards: VocabCard[];
  progress: Record<string, StoredFsrsCard>;
  dailyActivity: Record<string, DailyActivity>;
  now?: Date;
  calendarLength?: number;
}): ProgressStats {
  const now = params.now ?? new Date();
  const calendarLength = params.calendarLength ?? 28;
  const todayKey = getLocalDateKey(now);

  const masteryCounts: Record<MasteryBucket, number> = {
    new: 0,
    learning: 0,
    mastering: 0,
    memorized: 0,
  };

  const cefrLevels: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];
  const cefrMap: Record<CefrLevel, { total: number; started: number; mastered: number }> = {
    A2: { total: 0, started: 0, mastered: 0 },
    B1: { total: 0, started: 0, mastered: 0 },
    B2: { total: 0, started: 0, mastered: 0 },
    C1: { total: 0, started: 0, mastered: 0 },
  };

  for (const card of params.cards) {
    const bucket = classifyMastery(params.progress[card.id]);
    masteryCounts[bucket] += 1;

    const slot = cefrMap[card.cefr];
    slot.total += 1;
    if (bucket !== 'new') slot.started += 1;
    if (bucket === 'mastering' || bucket === 'memorized') slot.mastered += 1;
  }

  const cefrBreakdown: CefrProgressStat[] = cefrLevels.map((level) => {
    const slot = cefrMap[level];
    return {
      level,
      total: slot.total,
      started: slot.started,
      mastered: slot.mastered,
      percentStarted: slot.total > 0 ? Math.round((slot.started / slot.total) * 100) : 0,
      percentMastered: slot.total > 0 ? Math.round((slot.mastered / slot.total) * 100) : 0,
    };
  });

  const activeDatesSet = new Set(
    Object.values(params.dailyActivity)
      .filter((day) => day.reviews > 0)
      .map((day) => day.dateKey)
  );

  // Count backwards from today when reviewed today, or from yesterday while streak remains active
  let currentStreak = 0;
  let cursorOffset = activeDatesSet.has(todayKey) ? 0 : -1;
  while (activeDatesSet.has(getLocalDateKey(shiftDateKey(now, cursorOffset)))) {
    currentStreak += 1;
    cursorOffset -= 1;
  }

  const sortedActiveDates = [...activeDatesSet].sort();
  let longestStreak = 0;
  let running = 0;
  let prevTime: number | null = null;

  for (const key of sortedActiveDates) {
    const [y, m, d] = key.split('-').map(Number);
    const utcDay = Date.UTC(y, m - 1, d);
    if (prevTime !== null && utcDay - prevTime === 86_400_000) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreak) longestStreak = running;
    prevTime = utcDay;
  }

  let totalReviews = 0;
  let recalledCount = 0;
  for (const day of Object.values(params.dailyActivity)) {
    totalReviews += day.reviews;
    recalledCount += day.hardCount + day.goodCount + day.easyCount;
  }
  const retentionRate = totalReviews > 0 ? Math.round((recalledCount / totalReviews) * 100) : null;
  const reviewsToday = params.dailyActivity[todayKey]?.reviews ?? 0;

  const calendarDays: ActivityDayCell[] = [];
  for (let offset = -(calendarLength - 1); offset <= 0; offset += 1) {
    const d = shiftDateKey(now, offset);
    const key = getLocalDateKey(d);
    const activity = params.dailyActivity[key];
    const reviews = activity?.reviews ?? 0;
    const newStudied = activity?.newStudied ?? 0;

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (reviews >= 25) intensity = 4;
    else if (reviews >= 15) intensity = 3;
    else if (reviews >= 6) intensity = 2;
    else if (reviews >= 1) intensity = 1;

    calendarDays.push({
      dateKey: key,
      label: `${d.getDate()} ${SHORT_MONTHS_ID[d.getMonth()]}`,
      shortDay: SHORT_DAYS_ID[d.getDay()],
      reviews,
      newStudied,
      intensity,
      isToday: offset === 0,
    });
  }

  return {
    totalCards: params.cards.length,
    currentStreak,
    longestStreak,
    totalReviews,
    reviewsToday,
    retentionRate,
    masteryCounts,
    cefrBreakdown,
    calendarDays,
  };
}
