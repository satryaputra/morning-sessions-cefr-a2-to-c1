import type { DeckDefinition, LearningPhaseDefinition } from '../types';

export const STARTER_DECK_IDS = {
  FONDASI: 'oxford-3000-fondasi',
  MENENGAH: 'oxford-3000-menengah',
  BBC_IDIOMS: 'bbc-6min-idioms',
  OXFORD_C1: 'oxford-5000-c1',
} as const;

export const DEFAULT_CUSTOM_DECK_ID = 'koleksi-pribadi';

export const LEARNING_PHASES: LearningPhaseDefinition[] = [
  {
    id: 'phase-1',
    monthsLabel: 'Petunjuk ID aktif',
    title: 'Mode Fondasi',
    cefrTarget: 'A2–B1',
    curriculumLabel: 'Mode Fondasi',
    description:
      'Fokus pada frasa komunikasi harian, collocation inti, dan ungkapan percakapan yang paling sering dipakai.',
    recommendedDeckIds: [STARTER_DECK_IDS.FONDASI, STARTER_DECK_IDS.BBC_IDIOMS],
    suggestedHintDefault: true,
  },
  {
    id: 'phase-2',
    monthsLabel: 'Petunjuk ID aktif',
    title: 'Mode Menengah',
    cefrTarget: 'B1–B2',
    curriculumLabel: 'Mode Menengah',
    description:
      'Perluas phrasal verbs, bahasa diskusi kerja, serta idiom percakapan agar lebih lancar memahami podcast dan artikel.',
    recommendedDeckIds: [STARTER_DECK_IDS.MENENGAH, STARTER_DECK_IDS.BBC_IDIOMS],
    suggestedHintDefault: true,
  },
  {
    id: 'phase-3',
    monthsLabel: 'Tanpa petunjuk ID',
    title: 'Mode Menengah Atas',
    cefrTarget: 'B2',
    curriculumLabel: 'Mode Menengah Atas',
    description:
      'Matangkan kelancaran diskusi B2 sambil mengenalkan presisi dan nuansa kosakata tingkat lanjut.',
    recommendedDeckIds: [
      STARTER_DECK_IDS.MENENGAH,
      STARTER_DECK_IDS.BBC_IDIOMS,
      STARTER_DECK_IDS.OXFORD_C1,
    ],
    suggestedHintDefault: false,
  },
  {
    id: 'phase-4',
    monthsLabel: 'Tanpa petunjuk ID',
    title: 'Mode Mahir',
    cefrTarget: 'B2–C1',
    curriculumLabel: 'Mode Mahir',
    description:
      'Fokus pada kosakata akademis, argumen bernuansa, dan collocation presisi tinggi untuk berpikir langsung dalam bahasa Inggris.',
    recommendedDeckIds: [STARTER_DECK_IDS.OXFORD_C1],
    suggestedHintDefault: false,
  },
];

export const STARTER_DECKS: DeckDefinition[] = [
  {
    id: STARTER_DECK_IDS.FONDASI,
    title: 'Kosakata Fondasi',
    subtitle: 'Komunikasi Harian',
    description:
      'Frasa, collocation, dan kosakata esensial untuk percakapan sehari-hari, perjalanan, serta rutinitas kerja dasar.',
    cefrRange: 'A2–B1',
    recommendedPhases: ['phase-1'],
    phaseLabel: 'Mode Fondasi',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.MENENGAH,
    title: 'Kosakata Menengah',
    subtitle: 'Kerja & Diskusi',
    description:
      'Phrasal verbs produktif, collocation dunia kerja, cara menyampaikan opini, dan kosakata diskusi tingkat menengah.',
    cefrRange: 'B1–B2',
    recommendedPhases: ['phase-2', 'phase-3'],
    phaseLabel: 'Mode Menengah',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.BBC_IDIOMS,
    title: 'Idiom & Percakapan',
    subtitle: 'Ungkapan Natural',
    description:
      'Idiom dan ekspresi percakapan autentik agar telinga akrab dengan bahasa Inggris alami.',
    cefrRange: 'B1–B2',
    recommendedPhases: ['phase-1', 'phase-2', 'phase-3'],
    phaseLabel: 'Pendamping',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.OXFORD_C1,
    title: 'Kosakata Mahir C1',
    subtitle: 'Nuansa & Argumen',
    description:
      'Kosakata bernuansa tinggi, ungkapan akademis, dan collocation presisi untuk menulis dan berargumen setara C1.',
    cefrRange: 'B2–C1',
    recommendedPhases: ['phase-3', 'phase-4'],
    phaseLabel: 'Mode Mahir',
    isStarter: true,
  },
];

export function createPersonalDeck(): DeckDefinition {
  return {
    id: DEFAULT_CUSTOM_DECK_ID,
    title: 'Koleksi Pribadi',
    subtitle: 'Kartu Tambahan & Import',
    description:
      'Kalimat pilihan dari bacaan, podcast, atau daftar kosakata yang Anda tambahkan sendiri.',
    cefrRange: 'A2–C1',
    recommendedPhases: ['phase-1', 'phase-2', 'phase-3', 'phase-4'],
    phaseLabel: 'Kustom',
    isStarter: false,
  };
}
