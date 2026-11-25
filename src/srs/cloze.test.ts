import { describe, expect, it } from 'vitest';
import { applyClozeMarkup, extractClozePhrase, parseClozeSentence, stripClozeMarkup } from './cloze';
import { STARTER_CARDS, STARTER_DECKS } from '../data';

describe('Cloze parser & Starter Deck integrity', () => {
  it('parses explicit {{...}} cloze markers cleanly', () => {
    const parsed = parseClozeSentence(
      'We decided to {{call it a day}} after finishing the draft.',
      'call it a day'
    );

    expect(parsed.hasMatch).toBe(true);
    expect(parsed.cleanSentence).toBe('We decided to call it a day after finishing the draft.');
    expect(parsed.segments).toEqual([
      { type: 'text', value: 'We decided to ' },
      { type: 'cloze', value: 'call it a day' },
      { type: 'text', value: ' after finishing the draft.' },
    ]);
  });

  it('matches target phrases case-insensitively and preserves original sentence casing', () => {
    const parsed = parseClozeSentence(
      'In a nutshell, calm tools build stronger daily habits.',
      'in a nutshell'
    );

    expect(parsed.hasMatch).toBe(true);
    expect(parsed.targetPhrase).toBe('In a nutshell');
    expect(parsed.segments[0]).toEqual({ type: 'cloze', value: 'In a nutshell' });
  });

  it('wraps and strips Quick Cloze markup accurately', () => {
    const wrapped = applyClozeMarkup('Try to bear in mind the context.', 'bear in mind');
    expect(wrapped).toBe('Try to {{bear in mind}} the context.');
    expect(extractClozePhrase(wrapped)).toBe('bear in mind');
    expect(stripClozeMarkup(wrapped)).toBe('Try to bear in mind the context.');
  });

  it('ships 200 unique authentic starter cards across 4 curated decks with valid cloze matches', () => {
    expect(STARTER_DECKS).toHaveLength(4);
    expect(STARTER_CARDS).toHaveLength(200);

    const ids = new Set<string>();
    const validCefr = new Set(['A2', 'B1', 'B2', 'C1']);

    for (const card of STARTER_CARDS) {
      expect(ids.has(card.id), `Duplicate id ${card.id}`).toBe(false);
      ids.add(card.id);

      expect(card.phrase.trim().length, `Empty phrase on ${card.id}`).toBeGreaterThan(0);
      expect(card.sentence.trim().length, `Empty sentence on ${card.id}`).toBeGreaterThan(10);
      expect(card.ipa.trim().length, `Empty IPA on ${card.id}`).toBeGreaterThan(2);
      expect(card.definitionEn.trim().length, `Empty EN definition on ${card.id}`).toBeGreaterThan(5);
      expect(card.translationId.trim().length, `Empty ID translation on ${card.id}`).toBeGreaterThan(2);
      expect(card.notes.trim().length, `Empty notes on ${card.id}`).toBeGreaterThan(5);
      expect(validCefr.has(card.cefr), `Invalid CEFR on ${card.id}`).toBe(true);

      const parsed = parseClozeSentence(card.sentence, card.phrase);
      expect(
        parsed.hasMatch,
        `Phrase "${card.phrase}" did not match inside sentence for card ${card.id}: "${card.sentence}"`
      ).toBe(true);
    }
  });

  it('provides clean hints and full Indonesian practice translations on all 200 starter cards', () => {
    expect(STARTER_CARDS).toHaveLength(200);
    const forbiddenChars = /[•·→—]/;

    for (const card of STARTER_CARDS) {
      const def = card.definitionEn.trim();
      const sentenceTrans = (card.sentenceTranslationId ?? '').trim();
      const practice = (card.practiceSentence ?? '').trim();
      const practiceTrans = (card.practiceSentenceTranslationId ?? '').trim();

      expect(def.length, `Empty definitionEn on ${card.id}`).toBeGreaterThan(0);
      expect(
        def.toLowerCase().includes(card.phrase.trim().toLowerCase()),
        `definitionEn leaks phrase "${card.phrase}" on ${card.id}`
      ).toBe(false);

      expect(sentenceTrans.length, `Empty sentenceTranslationId on ${card.id}`).toBeGreaterThan(0);
      expect(practice.length, `Empty practiceSentence on ${card.id}`).toBeGreaterThan(0);
      expect(practiceTrans.length, `Empty practiceSentenceTranslationId on ${card.id}`).toBeGreaterThan(0);
      expect(
        practiceTrans,
        `practiceSentenceTranslationId should translate practiceSentence rather than copy sentenceTranslationId on ${card.id}`
      ).not.toBe(sentenceTrans);

      expect(forbiddenChars.test(def), `Forbidden character in definitionEn on ${card.id}`).toBe(false);
      expect(
        forbiddenChars.test(sentenceTrans),
        `Forbidden character in sentenceTranslationId on ${card.id}`
      ).toBe(false);
      expect(
        forbiddenChars.test(practice),
        `Forbidden character in practiceSentence on ${card.id}`
      ).toBe(false);
      expect(
        forbiddenChars.test(practiceTrans),
        `Forbidden character in practiceSentenceTranslationId on ${card.id}`
      ).toBe(false);
    }
  });
});
