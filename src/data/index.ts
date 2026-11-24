import type { VocabCard } from '../types';
import { DECK_FONDASI_CARDS } from './deckFondasi';
import { DECK_MENENGAH_CARDS } from './deckMenengah';
import { DECK_BBC_IDIOMS_CARDS } from './deckBbcIdioms';
import { DECK_OXFORD_C1_CARDS } from './deckOxfordC1';

export {
  STARTER_DECK_IDS,
  DEFAULT_CUSTOM_DECK_ID,
  LEARNING_PHASES,
  STARTER_DECKS,
  createPersonalDeck,
} from './curriculum';

export const STARTER_CARDS: VocabCard[] = [
  ...DECK_FONDASI_CARDS,
  ...DECK_MENENGAH_CARDS,
  ...DECK_BBC_IDIOMS_CARDS,
  ...DECK_OXFORD_C1_CARDS,
];

export const STARTER_CARDS_BY_DECK: Record<string, VocabCard[]> = {
  [DECK_FONDASI_CARDS[0].deckId]: DECK_FONDASI_CARDS,
  [DECK_MENENGAH_CARDS[0].deckId]: DECK_MENENGAH_CARDS,
  [DECK_BBC_IDIOMS_CARDS[0].deckId]: DECK_BBC_IDIOMS_CARDS,
  [DECK_OXFORD_C1_CARDS[0].deckId]: DECK_OXFORD_C1_CARDS,
};
