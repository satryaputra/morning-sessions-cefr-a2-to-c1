import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseVocabImport, SAMPLE_CSV_TEMPLATE } from './csvParser';
import { parseBackup, serializeBackup } from './backup';
import { createInitialAppState, loadAppState, saveAppState, type StorageLike } from '../storage/state';
import { applyCardReview } from '../srs/engine';
import { STARTER_CARDS } from '../data';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('CSV / TSV Import Parser', () => {
  it('parses the built-in CSV sample template with quoted commas accurately', () => {
    const result = parseVocabImport(SAMPLE_CSV_TEMPLATE, {
      deckId: 'koleksi-pribadi',
      idPrefix: 'test-csv',
    });

    expect(result.delimiter).toBe(',');
    expect(result.hasHeader).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].phrase).toBe('keep pace with');
    expect(result.cards[0].cefr).toBe('B2');
    expect(result.cards[1].partOfSpeech).toBe('idiom');
    expect(result.cards[2].cefr).toBe('C1');
  });

  it('auto-detects TSV and supports headerless {{cloze}} two-column paste', () => {
    const tsv = [
      'We should {{take stock of}} our progress every Friday.\tmengevaluasi situasi saat ini',
      'She decided to {{brush up on}} her spoken British English.\tmengasah kembali kemampuan',
    ].join('\n');

    expect(detectDelimiter(tsv)).toBe('\t');
    const result = parseVocabImport(tsv, { deckId: 'koleksi-pribadi', defaultCefr: 'B2' });

    expect(result.delimiter).toBe('\t');
    expect(result.hasHeader).toBe(false);
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].phrase).toBe('take stock of');
    expect(result.cards[0].translationId).toBe('mengevaluasi situasi saat ini');
    expect(result.cards[1].cefr).toBe('B2');
  });

  it('warns and skips incomplete rows gracefully', () => {
    const csv = 'phrase,sentence,translation\n,"Sentence without phrase",arti\nvalid phrase,"A valid phrase in context.",frasa valid';
    const result = parseVocabImport(csv, { deckId: 'koleksi-pribadi' });

    expect(result.cards).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('Backup Serialization & Storage Persistence', () => {
  it('serializes and restores complete state cleanly with summary stats', () => {
    const now = new Date('2026-06-15T07:00:00.000Z');
    const base = createInitialAppState();
    const { nextState } = applyCardReview(base, STARTER_CARDS[0], 'good', now);
    nextState.customCards.push({
      id: 'custom-1',
      deckId: 'koleksi-pribadi',
      phrase: 'silver lining',
      sentence: 'Every setback carries a {{silver lining}}.',
      ipa: '/ˌsɪlvə ˈlaɪnɪŋ/',
      definitionEn: 'a bright side in a hard situation',
      translationId: 'sisi positif',
      partOfSpeech: 'idiom',
      cefr: 'B2',
      notes: 'Dari BBC 6 Minute English',
      isCustom: true,
    });

    const json = serializeBackup(nextState, now);
    const restored = parseBackup(json);

    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.summary.trackedCards).toBe(1);
      expect(restored.summary.customCards).toBe(1);
      expect(restored.summary.totalReviews).toBe(1);
      expect(restored.payload.state.progress[STARTER_CARDS[0].id]).toEqual(
        nextState.progress[STARTER_CARDS[0].id]
      );
      expect(restored.payload.state.customCards).toHaveLength(1);
    }
  });

  it('rejects malformed or non-PagiKata JSON files safely', () => {
    const invalidJson = parseBackup('{not-json');
    expect(invalidJson.ok).toBe(false);

    const wrongApp = parseBackup(JSON.stringify({ app: 'OtherApp', schemaVersion: 1, state: {} }));
    expect(wrongApp.ok).toBe(false);

    const futureVersion = parseBackup(
      JSON.stringify({ app: 'PagiKata', schemaVersion: 99, state: {} })
    );
    expect(futureVersion.ok).toBe(false);
  });

  it('persists and reloads state via structured storage adapter', () => {
    const storage = createMemoryStorage();
    const initial = createInitialAppState();
    initial.settings.dailyNewLimit = 15;
    initial.settings.theme = 'dark';

    expect(saveAppState(initial, storage)).toBe(true);
    const loaded = loadAppState(storage);

    expect(loaded.settings.dailyNewLimit).toBe(15);
    expect(loaded.settings.theme).toBe('dark');
    expect(loaded.schemaVersion).toBe(1);
  });
});
