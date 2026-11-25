import type {
  AppState,
  DailyActivity,
  DeckDefinition,
  ElevenLabsModelId,
  LearningPhaseId,
  ReviewRatingKey,
  StoredFsrsCard,
  UserSettings,
  VocabCard,
} from '../types';
import { LEARNING_PHASES, STARTER_DECK_IDS } from '../data';
import { getDefaultElevenLabsSettings } from '../speech/elevenlabs';

export const STORAGE_KEY = 'pagikata_state_v1';
export const CURRENT_SCHEMA_VERSION = 1 as const;

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultSettings(phaseId: LearningPhaseId = 'phase-1'): UserSettings {
  const phase = LEARNING_PHASES.find((p) => p.id === phaseId) ?? LEARNING_PHASES[0];
  return {
    phaseId: phase.id,
    activeDeckIds: [...phase.recommendedDeckIds],
    dailyNewLimit: 10,
    showIndonesianHint: phase.suggestedHintDefault,
    accent: 'en-US',
    speechRate: 1.0,
    ttsProvider: 'browser',
    elevenLabs: getDefaultElevenLabsSettings(),
    theme: 'light',
  };
}

export function createInitialAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: getDefaultSettings('phase-1'),
    customDecks: [],
    customCards: [],
    progress: {},
    dailyActivity: {},
    reviewHistory: [],
  };
}

export function getEmptyDailyActivity(dateKey: string): DailyActivity {
  return {
    dateKey,
    reviews: 0,
    newStudied: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    extraNewGranted: 0,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRatingCounts(raw: unknown) {
  const counts = isPlainObject(raw) ? raw : {};
  return {
    again: typeof counts.again === 'number' ? counts.again : 0,
    hard: typeof counts.hard === 'number' ? counts.hard : 0,
    good: typeof counts.good === 'number' ? counts.good : 0,
    easy: typeof counts.easy === 'number' ? counts.easy : 0,
  };
}

const VALID_RATING_KEYS: ReadonlySet<ReviewRatingKey> = new Set(['again', 'hard', 'good', 'easy']);

function isReviewRatingKey(value: unknown): value is ReviewRatingKey {
  return typeof value === 'string' && VALID_RATING_KEYS.has(value as ReviewRatingKey);
}

function normalizeStoredFsrsCard(value: unknown): StoredFsrsCard | undefined {
  if (
    !isPlainObject(value) ||
    typeof value.due !== 'string' ||
    typeof value.stability !== 'number' ||
    typeof value.difficulty !== 'number' ||
    typeof value.state !== 'number'
  ) {
    return undefined;
  }
  return {
    due: value.due,
    stability: value.stability,
    difficulty: value.difficulty,
    elapsed_days: typeof value.elapsed_days === 'number' ? value.elapsed_days : 0,
    scheduled_days: typeof value.scheduled_days === 'number' ? value.scheduled_days : 0,
    learning_steps: typeof value.learning_steps === 'number' ? value.learning_steps : 0,
    reps: typeof value.reps === 'number' ? value.reps : 0,
    lapses: typeof value.lapses === 'number' ? value.lapses : 0,
    state: value.state,
    last_review: typeof value.last_review === 'string' ? value.last_review : undefined,
  };
}

function normalizeRatingMap(
  raw: unknown,
  allowedIds?: Set<string>
): Record<string, ReviewRatingKey> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const result: Record<string, ReviewRatingKey> = {};
  for (const [cardId, rating] of Object.entries(raw)) {
    if (cardId.length > 0 && (!allowedIds || allowedIds.has(cardId)) && isReviewRatingKey(rating)) {
      result[cardId] = rating;
    }
  }
  return result;
}

function normalizeBaselines(raw: unknown): Record<string, StoredFsrsCard | null> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const result: Record<string, StoredFsrsCard | null> = {};
  for (const [cardId, value] of Object.entries(raw)) {
    if (cardId.length === 0) continue;
    if (value === null) {
      result[cardId] = null;
    } else {
      const card = normalizeStoredFsrsCard(value);
      if (card) result[cardId] = card;
    }
  }
  return result;
}

function normalizeDailyStudy(raw: unknown): AppState['dailyStudy'] {
  if (!isPlainObject(raw) || typeof raw.dateKey !== 'string') return undefined;
  const ids = (value: unknown): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [];
  const pairedIds = ids(raw.pairedIds);
  const paired = new Set(pairedIds);
  const listeningRatingsByCard = normalizeRatingMap(raw.listeningRatingsByCard, paired);
  const answeredRatingsByCard = normalizeRatingMap(raw.answeredRatingsByCard);
  const clozeDueIds = Array.isArray(raw.clozeDueIds) ? ids(raw.clozeDueIds) : undefined;
  const clozeBaselines = normalizeBaselines(raw.clozeBaselines);
  const listeningFinishedCount =
    typeof raw.listeningFinishedCount === 'number' &&
    Number.isFinite(raw.listeningFinishedCount) &&
    raw.listeningFinishedCount >= 0
      ? Math.floor(raw.listeningFinishedCount)
      : undefined;
  const clozeFinishedCount =
    typeof raw.clozeFinishedCount === 'number' &&
    Number.isFinite(raw.clozeFinishedCount) &&
    raw.clozeFinishedCount >= 0
      ? Math.floor(raw.clozeFinishedCount)
      : undefined;

  return {
    dateKey: raw.dateKey,
    pairedIds,
    practiceIds: ids(raw.practiceIds).filter((id) => paired.has(id)),
    listenedIds: ids(raw.listenedIds).filter((id) => paired.has(id)),
    answeredIds: ids(raw.answeredIds),
    ...(listeningRatingsByCard ? { listeningRatingsByCard } : {}),
    ...(answeredRatingsByCard ? { answeredRatingsByCard } : {}),
    ...(clozeDueIds ? { clozeDueIds } : {}),
    ...(clozeBaselines ? { clozeBaselines } : {}),
    ...(listeningFinishedCount !== undefined ? { listeningFinishedCount } : {}),
    ...(clozeFinishedCount !== undefined ? { clozeFinishedCount } : {}),
  };
}

/**
 * Validates and normalizes an unknown object into a safe AppState.
 */
export function normalizeAppState(raw: unknown): AppState {
  const fallback = createInitialAppState();
  if (!isPlainObject(raw)) {
    return fallback;
  }

  const rawSettings = isPlainObject(raw.settings) ? raw.settings : {};
  const validPhaseIds: LearningPhaseId[] = ['phase-1', 'phase-2', 'phase-3', 'phase-4'];
  const phaseId = validPhaseIds.includes(rawSettings.phaseId as LearningPhaseId)
    ? (rawSettings.phaseId as LearningPhaseId)
    : fallback.settings.phaseId;

  const dailyNewLimit =
    rawSettings.dailyNewLimit === 5 ||
    rawSettings.dailyNewLimit === 10 ||
    rawSettings.dailyNewLimit === 15
      ? rawSettings.dailyNewLimit
      : fallback.settings.dailyNewLimit;

  const accent =
    rawSettings.accent === 'en-GB' || rawSettings.accent === 'en-US'
      ? rawSettings.accent
      : fallback.settings.accent;

  const speechRate =
    rawSettings.speechRate === 1.0 || rawSettings.speechRate === 0.8
      ? rawSettings.speechRate
      : fallback.settings.speechRate;

  const ttsProvider =
    rawSettings.ttsProvider === 'browser' || rawSettings.ttsProvider === 'elevenlabs'
      ? rawSettings.ttsProvider
      : fallback.settings.ttsProvider;

  const rawEl = isPlainObject(rawSettings.elevenLabs) ? rawSettings.elevenLabs : {};
  const defaultEl = getDefaultElevenLabsSettings();
  const modelId: ElevenLabsModelId =
    rawEl.modelId === 'eleven_flash_v2_5' || rawEl.modelId === 'eleven_multilingual_v2'
      ? rawEl.modelId
      : defaultEl.modelId;
  const elevenLabs = {
    modelId,
    ukVoiceId:
      typeof rawEl.ukVoiceId === 'string' && rawEl.ukVoiceId.trim().length > 0
        ? rawEl.ukVoiceId.trim()
        : defaultEl.ukVoiceId,
    usVoiceId:
      typeof rawEl.usVoiceId === 'string' && rawEl.usVoiceId.trim().length > 0
        ? rawEl.usVoiceId.trim()
        : defaultEl.usVoiceId,
    customProxyUrl:
      typeof rawEl.customProxyUrl === 'string' ? rawEl.customProxyUrl.trim() : '',
  };

  const theme =
    rawSettings.theme === 'light' ||
    rawSettings.theme === 'dark' ||
    rawSettings.theme === 'system'
      ? rawSettings.theme
      : fallback.settings.theme;

  const activeDeckIds = Array.isArray(rawSettings.activeDeckIds)
    ? rawSettings.activeDeckIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [STARTER_DECK_IDS.FONDASI, STARTER_DECK_IDS.BBC_IDIOMS];

  const customDecks: DeckDefinition[] = Array.isArray(raw.customDecks)
    ? raw.customDecks.filter(
        (d): d is DeckDefinition =>
          isPlainObject(d) && typeof d.id === 'string' && typeof d.title === 'string'
      )
    : [];

  const customCards: VocabCard[] = Array.isArray(raw.customCards)
    ? raw.customCards.filter(
        (c): c is VocabCard =>
          isPlainObject(c) &&
          typeof c.id === 'string' &&
          typeof c.deckId === 'string' &&
          typeof c.phrase === 'string' &&
          typeof c.sentence === 'string'
      )
    : [];

  const progress: AppState['progress'] = {};
  if (isPlainObject(raw.progress)) {
    for (const [cardId, value] of Object.entries(raw.progress)) {
      const card = normalizeStoredFsrsCard(value);
      if (card) {
        progress[cardId] = card;
      }
    }
  }

  const dailyActivity: AppState['dailyActivity'] = {};
  if (isPlainObject(raw.dailyActivity)) {
    for (const [dateKey, entry] of Object.entries(raw.dailyActivity)) {
      if (isPlainObject(entry)) {
        dailyActivity[dateKey] = {
          dateKey,
          reviews: typeof entry.reviews === 'number' ? entry.reviews : 0,
          newStudied: typeof entry.newStudied === 'number' ? entry.newStudied : 0,
          againCount: typeof entry.againCount === 'number' ? entry.againCount : 0,
          hardCount: typeof entry.hardCount === 'number' ? entry.hardCount : 0,
          goodCount: typeof entry.goodCount === 'number' ? entry.goodCount : 0,
          easyCount: typeof entry.easyCount === 'number' ? entry.easyCount : 0,
          extraNewGranted: typeof entry.extraNewGranted === 'number' ? entry.extraNewGranted : 0,
          practiceCompleted: typeof entry.practiceCompleted === 'number' ? entry.practiceCompleted : 0,
          practiceRatings: normalizeRatingCounts(entry.practiceRatings),
          listeningRatings: normalizeRatingCounts(entry.listeningRatings),
        };
      }
    }
  }

  const reviewHistory = Array.isArray(raw.reviewHistory)
    ? raw.reviewHistory.filter(
        (item): item is AppState['reviewHistory'][number] =>
          isPlainObject(item) &&
          typeof item.id === 'string' &&
          typeof item.cardId === 'string' &&
          typeof item.rating === 'string' &&
          typeof item.reviewedAt === 'string'
      )
    : [];

  const trimmedHistory = reviewHistory.slice(-2000);
  let dailyStudy = normalizeDailyStudy(raw.dailyStudy);

  if (dailyStudy && dailyStudy.answeredIds.length > 0) {
    let backfilledRatings: Record<string, ReviewRatingKey> | undefined =
      dailyStudy.answeredRatingsByCard ? { ...dailyStudy.answeredRatingsByCard } : undefined;

    for (const cardId of dailyStudy.answeredIds) {
      if (backfilledRatings?.[cardId]) continue;
      for (let i = trimmedHistory.length - 1; i >= 0; i -= 1) {
        const entry = trimmedHistory[i];
        if (
          entry.cardId === cardId &&
          entry.dateKey === dailyStudy.dateKey &&
          isReviewRatingKey(entry.rating)
        ) {
          if (!backfilledRatings) backfilledRatings = {};
          backfilledRatings[cardId] = entry.rating;
          break;
        }
      }
    }

    if (backfilledRatings) {
      dailyStudy = {
        ...dailyStudy,
        answeredRatingsByCard: backfilledRatings,
      };
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      phaseId,
      activeDeckIds,
      dailyNewLimit,
      showIndonesianHint:
        typeof rawSettings.showIndonesianHint === 'boolean'
          ? rawSettings.showIndonesianHint
          : fallback.settings.showIndonesianHint,
      accent,
      speechRate,
      ttsProvider,
      elevenLabs,
      theme,
    },
    customDecks,
    customCards,
    progress,
    dailyActivity,
    reviewHistory: trimmedHistory,
    dailyStudy,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadAppState(storage: StorageLike | null = getBrowserStorage()): AppState {
  if (!storage) return createInitialAppState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialAppState();
    const parsed: unknown = JSON.parse(raw);
    return normalizeAppState(parsed);
  } catch {
    return createInitialAppState();
  }
}

export function saveAppState(
  state: AppState,
  storage: StorageLike | null = getBrowserStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
