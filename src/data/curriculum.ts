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
    monthsLabel: 'Bulan 1–3',
    title: 'Fondasi A2 → B1',
    cefrTarget: 'A2 → B1',
    curriculumLabel: 'BBC Lower-Intermediate',
    description:
      'Bangun kebiasaan pagi dengan frasa komunikasi harian, collocation inti, dan ungkapan BBC yang sering muncul.',
    recommendedDeckIds: [STARTER_DECK_IDS.FONDASI, STARTER_DECK_IDS.BBC_IDIOMS],
    suggestedHintDefault: true,
  },
  {
    id: 'phase-2',
    monthsLabel: 'Bulan 4–6',
    title: 'Menengah B1 → B2',
    cefrTarget: 'B1 → B2',
    curriculumLabel: 'BBC Intermediate',
    description:
      'Perluas phrasal verbs, bahasa diskusi kerja, serta idiom natural agar makin lancar memahami podcast & artikel.',
    recommendedDeckIds: [STARTER_DECK_IDS.MENENGAH, STARTER_DECK_IDS.BBC_IDIOMS],
    suggestedHintDefault: true,
  },
  {
    id: 'phase-3',
    monthsLabel: 'Bulan 7–9',
    title: 'Menengah Atas B2',
    cefrTarget: 'B2',
    curriculumLabel: 'BBC Upper-Intermediate',
    description:
      'Matangkan kelancaran diskusi B2 sambil mulai mengenalkan presisi dan nuansa kosakata tingkat lanjut.',
    recommendedDeckIds: [
      STARTER_DECK_IDS.MENENGAH,
      STARTER_DECK_IDS.BBC_IDIOMS,
      STARTER_DECK_IDS.OXFORD_C1,
    ],
    suggestedHintDefault: false,
  },
  {
    id: 'phase-4',
    monthsLabel: 'Bulan 10–12',
    title: 'Menuju Mahir B2+ → C1',
    cefrTarget: 'B2+ → C1',
    curriculumLabel: 'BBC Towards Advanced',
    description:
      'Fokus pada kosakata akademis, argumen bernuansa, dan collocation presisi tinggi untuk berpikir langsung dalam bahasa Inggris.',
    recommendedDeckIds: [STARTER_DECK_IDS.OXFORD_C1],
    suggestedHintDefault: false,
  },
];

export const STARTER_DECKS: DeckDefinition[] = [
  {
    id: STARTER_DECK_IDS.FONDASI,
    title: 'Oxford 3000: Fondasi',
    subtitle: 'A2 → B1 • Komunikasi Harian',
    description:
      'Frasa, collocation, dan kosakata esensial untuk percakapan sehari-hari, perjalanan, serta rutinitas kerja dasar.',
    cefrRange: 'A2–B1',
    recommendedPhases: ['phase-1'],
    phaseLabel: 'Fase 1 • Bulan 1–3',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.MENENGAH,
    title: 'Oxford 3000: Menengah',
    subtitle: 'B1 → B2 • Kerja & Diskusi',
    description:
      'Phrasal verbs produktif, collocation dunia kerja, cara menyampaikan opini, dan kosakata diskusi tingkat menengah.',
    cefrRange: 'B1–B2',
    recommendedPhases: ['phase-2', 'phase-3'],
    phaseLabel: 'Fase 2 • Bulan 4–6',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.BBC_IDIOMS,
    title: 'BBC 6 Minute English: Idioms',
    subtitle: 'B1 → B2 • Ungkapan Natural',
    description:
      'Idiom dan ekspresi percakapan autentik bergaya BBC Learning English agar telinga akrab dengan bahasa Inggris alami.',
    cefrRange: 'B1–B2',
    recommendedPhases: ['phase-1', 'phase-2', 'phase-3'],
    phaseLabel: 'Pendamping • Bulan 1–9',
    isStarter: true,
  },
  {
    id: STARTER_DECK_IDS.OXFORD_C1,
    title: 'Oxford 5000: C1 Precision',
    subtitle: 'B2 → C1 • Nuansa & Argumen',
    description:
      'Kosakata bernuansa tinggi, ungkapan akademis, dan collocation presisi untuk menulis dan berargumen setara C1.',
    cefrRange: 'B2–C1',
    recommendedPhases: ['phase-3', 'phase-4'],
    phaseLabel: 'Fase 3–4 • Bulan 7–12',
    isStarter: true,
  },
];

export function createPersonalDeck(): DeckDefinition {
  return {
    id: DEFAULT_CUSTOM_DECK_ID,
    title: 'Koleksi Pribadi',
    subtitle: 'Kartu Tambahan & Import',
    description:
      'Kalimat pilihan dari BBC Learning English, podcast, atau daftar kosakata yang Anda tambahkan sendiri.',
    cefrRange: 'A2–C1',
    recommendedPhases: ['phase-1', 'phase-2', 'phase-3', 'phase-4'],
    phaseLabel: 'Opsional • Kustom',
    isStarter: false,
  };
}
