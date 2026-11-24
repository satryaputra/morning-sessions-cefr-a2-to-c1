import type { AppState, DailyActivity, DeckDefinition, LearningPhaseId, UserSettings, VocabCard } from '../types';
import { LEARNING_PHASES, STARTER_DECK_IDS } from '../data';

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
    studyMode: 'cloze',
    showIndonesianHint: phase.suggestedHintDefault,
    accent: 'en-GB',
    speechRate: 1.0,
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

  const studyMode =
    rawSettings.studyMode === 'cloze' || rawSettings.studyMode === 'listening'
      ? rawSettings.studyMode
      : fallback.settings.studyMode;

  const accent =
    rawSettings.accent === 'en-GB' || rawSettings.accent === 'en-US'
      ? rawSettings.accent
      : fallback.settings.accent;

  const speechRate =
    rawSettings.speechRate === 1.0 || rawSettings.speechRate === 0.8
      ? rawSettings.speechRate
      : fallback.settings.speechRate;

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
      if (
        isPlainObject(value) &&
        typeof value.due === 'string' &&
        typeof value.stability === 'number' &&
        typeof value.difficulty === 'number' &&
        typeof value.state === 'number'
      ) {
        progress[cardId] = {
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

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      phaseId,
      activeDeckIds,
      dailyNewLimit,
      studyMode,
      showIndonesianHint:
        typeof rawSettings.showIndonesianHint === 'boolean'
          ? rawSettings.showIndonesianHint
          : fallback.settings.showIndonesianHint,
      accent,
      speechRate,
      theme,
    },
    customDecks,
    customCards,
    progress,
    dailyActivity,
    reviewHistory: reviewHistory.slice(-2000),
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
