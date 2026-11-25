export type CefrLevel = 'A2' | 'B1' | 'B2' | 'C1';

export type LearningPhaseId = 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';

export type DailyNewPreset = 5 | 10 | 15;

export type StudyMode = 'cloze' | 'listening';

export type SpeechAccent = 'en-GB' | 'en-US';

export type SpeechRate = 1.0 | 0.8;

export type TtsProvider = 'browser' | 'elevenlabs';

export type ElevenLabsModelId = 'eleven_flash_v2_5' | 'eleven_multilingual_v2';

export interface ElevenLabsSettings {
  modelId: ElevenLabsModelId;
  ukVoiceId: string;
  usVoiceId: string;
  customProxyUrl: string;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export type ReviewRatingKey = 'again' | 'hard' | 'good' | 'easy';

export type MasteryBucket = 'new' | 'learning' | 'mastering' | 'memorized';

export type NavTab = 'today' | 'progress' | 'settings';

export type SettingsSectionId = 'learning' | 'voice' | 'decks' | 'import';

export interface VocabCard {
  id: string;
  deckId: string;
  phrase: string;
  sentence: string;
  ipa: string;
  definitionEn: string;
  translationId: string;
  partOfSpeech: string;
  cefr: CefrLevel;
  notes: string;
  isCustom?: boolean;
  createdAt?: string;
}

export interface DeckDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  cefrRange: string;
  recommendedPhases: LearningPhaseId[];
  phaseLabel: string;
  isStarter: boolean;
}

export interface LearningPhaseDefinition {
  id: LearningPhaseId;
  monthsLabel: string;
  title: string;
  cefrTarget: string;
  curriculumLabel: string;
  description: string;
  recommendedDeckIds: string[];
  suggestedHintDefault: boolean;
}

/**
 * Serialized representation of a ts-fsrs Card stored cleanly as JSON.
 */
export interface StoredFsrsCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

export interface ReviewLogEntry {
  id: string;
  cardId: string;
  deckId: string;
  rating: ReviewRatingKey;
  reviewedAt: string;
  dateKey: string;
  wasNew: boolean;
}

export interface DailyActivity {
  dateKey: string;
  reviews: number;
  newStudied: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  extraNewGranted: number;
}

export interface UserSettings {
  phaseId: LearningPhaseId;
  activeDeckIds: string[];
  dailyNewLimit: DailyNewPreset;
  studyMode: StudyMode;
  showIndonesianHint: boolean;
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  theme: ThemePreference;
}

export interface AppState {
  schemaVersion: 1;
  settings: UserSettings;
  customDecks: DeckDefinition[];
  customCards: VocabCard[];
  progress: Record<string, StoredFsrsCard>;
  dailyActivity: Record<string, DailyActivity>;
  reviewHistory: ReviewLogEntry[];
}

export interface BackupPayload {
  app: 'vocab-srs' | 'PagiKata';
  schemaVersion: 1;
  exportedAt: string;
  state: AppState;
}
