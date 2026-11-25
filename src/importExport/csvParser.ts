import type { CefrLevel, VocabCard } from '../types';
import { extractClozePhrase, getStudySentences, stripClozeMarkup } from '../srs/cloze';

export interface CsvImportResult {
  cards: VocabCard[];
  warnings: string[];
  delimiter: ',' | '\t' | ';';
  hasHeader: boolean;
}

export const SAMPLE_CSV_TEMPLATE = `phrase,sentence,ipa,definition,translation,partOfSpeech,cefr,notes
keep pace with,"Daily audio clips help learners keep pace with natural English speech.",/kiːp peɪs wɪð/,"to move or develop at the same speed as something","mengimbangi kecepatan / mengikuti perkembangan",phrase,B2,"Sering dipakai bersama change, technology, atau spoken English."
bite the bullet,"I finally decided to bite the bullet and speak only English during our weekly call.",/baɪt ðə ˈbʊlɪt/,"to force yourself to do something difficult or unpleasant that you have been avoiding","memberanikan diri menghadapi hal sulit",idiom,B2,"Idiom percakapan yang sering dipakai dalam diskusi sehari-hari."
pragmatic,"We took a pragmatic approach by focusing on ten high-frequency phrases a day.",/præɡˈmætɪk/,"dealing with problems sensibly and realistically","pragmatis / realistis dan praktis",adjective,C1,"Collocation: a pragmatic approach / solution."`;

const HEADER_ALIASES: Record<string, keyof ColumnMap> = {
  phrase: 'phrase',
  word: 'phrase',
  term: 'phrase',
  target: 'phrase',
  kata: 'phrase',
  frasa: 'phrase',
  expression: 'phrase',
  sentence: 'sentence',
  example: 'sentence',
  context: 'sentence',
  cloze: 'sentence',
  kalimat: 'sentence',
  sentencetranslationid: 'sentenceTranslationId',
  terjemahankalimat: 'sentenceTranslationId',
  practicesentence: 'practiceSentence',
  kalimattebakkata: 'practiceSentence',
  ipa: 'ipa',
  phonetic: 'ipa',
  pronunciation: 'ipa',
  definition: 'definitionEn',
  definitionen: 'definitionEn',
  meaning: 'definitionEn',
  definisi: 'definitionEn',
  translation: 'translationId',
  translationid: 'translationId',
  arti: 'translationId',
  indonesian: 'translationId',
  terjemahan: 'translationId',
  hint: 'translationId',
  partofspeech: 'partOfSpeech',
  pos: 'partOfSpeech',
  type: 'partOfSpeech',
  kelas: 'partOfSpeech',
  cefr: 'cefr',
  level: 'cefr',
  notes: 'notes',
  note: 'notes',
  catatan: 'notes',
  collocation: 'notes',
};

interface ColumnMap {
  phrase?: number;
  sentence?: number;
  sentenceTranslationId?: number;
  practiceSentence?: number;
  ipa?: number;
  definitionEn?: number;
  translationId?: number;
  partOfSpeech?: number;
  cefr?: number;
  notes?: number;
}

export function detectDelimiter(raw: string): ',' | '\t' | ';' {
  const firstNonEmptyLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) return ',';

  const tabCount = (firstNonEmptyLine.match(/\t/g) ?? []).length;
  const commaCount = (firstNonEmptyLine.match(/,/g) ?? []).length;
  const semiCount = (firstNonEmptyLine.match(/;/g) ?? []).length;

  if (tabCount >= commaCount && tabCount >= semiCount && tabCount > 0) return '\t';
  if (semiCount > commaCount && semiCount > 0) return ';';
  return ',';
}

/**
 * Parses delimited CSV/TSV text handling quoted values and escaped quotes ("").
 */
export function parseDelimitedRows(raw: string, delimiter: ',' | '\t' | ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const text = raw.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCefr(value: string | undefined, fallback: CefrLevel): CefrLevel {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'A2' || upper === 'B1' || upper === 'B2' || upper === 'C1') {
    return upper;
  }
  return fallback;
}

function detectColumnMap(firstRow: string[]): { map: ColumnMap; hasHeader: boolean } {
  const map: ColumnMap = {};
  let matches = 0;

  firstRow.forEach((cell, idx) => {
    const key = HEADER_ALIASES[normalizeHeaderKey(cell)];
    if (key && map[key] === undefined) {
      map[key] = idx;
      matches += 1;
    }
  });

  if (matches >= 2) {
    return { map, hasHeader: true };
  }

  return {
    hasHeader: false,
    map: {
      phrase: 0,
      sentence: 1,
      translationId: 2,
      definitionEn: 3,
      ipa: 4,
      partOfSpeech: 5,
      cefr: 6,
      notes: 7,
    },
  };
}

/**
 * Parses CSV or TSV text into VocabCard objects ready for preview & import.
 */
export function parseVocabImport(
  rawText: string,
  options: {
    deckId: string;
    defaultCefr?: CefrLevel;
    idPrefix?: string;
    nowIso?: string;
  }
): CsvImportResult {
  const defaultCefr = options.defaultCefr ?? 'B1';
  const idPrefix = options.idPrefix ?? `imp-${Date.now()}`;
  const nowIso = options.nowIso ?? new Date().toISOString();

  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      cards: [],
      warnings: [],
      delimiter: ',',
      hasHeader: false,
    };
  }

  const delimiter = detectDelimiter(trimmed);
  const rows = parseDelimitedRows(trimmed, delimiter);
  if (rows.length === 0) {
    return {
      cards: [],
      warnings: ['Tidak ditemukan baris data yang valid.'],
      delimiter,
      hasHeader: false,
    };
  }

  const { map, hasHeader } = detectColumnMap(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const warnings: string[] = [];
  const cards: VocabCard[] = [];

  dataRows.forEach((cols, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    const get = (colIndex: number | undefined): string =>
      colIndex !== undefined && colIndex < cols.length ? cols[colIndex].trim() : '';

    let phrase = get(map.phrase);
    let sentence = get(map.sentence);
    let translationId = get(map.translationId);
    const definitionEn = get(map.definitionEn);
    const ipa = get(map.ipa);
    const partOfSpeech = get(map.partOfSpeech) || 'phrase';
    const cefr = normalizeCefr(get(map.cefr), defaultCefr);
    const notes = get(map.notes);
    const practiceSentence = get(map.practiceSentence);
    const sentenceTranslationId = get(map.sentenceTranslationId);

    // Support 2-column quick cloze format: "sentence with {{phrase}}, translation"
    if (!hasHeader && cols.length === 2 && extractClozePhrase(cols[0])) {
      sentence = cols[0];
      phrase = extractClozePhrase(cols[0]) ?? '';
      translationId = cols[1];
    } else if (!phrase && sentence) {
      phrase = extractClozePhrase(sentence) ?? '';
    }

    if (!phrase && !sentence) {
      warnings.push(`Baris ${rowNum} dilewati karena frasa dan kalimat kosong.`);
      return;
    }

    if (!phrase) {
      warnings.push(
        `Baris ${rowNum} tidak memiliki kolom frasa target (tambahkan kolom phrase atau tandai dengan {{frasa}}).`
      );
      return;
    }

    if (!sentence) {
      sentence = `I want to use "${phrase}" naturally in my next conversation.`;
      warnings.push(`Baris ${rowNum} ("${phrase}") tidak memiliki kalimat konteks, dibuatkan kalimat standar.`);
    }

    const cleanSentence = stripClozeMarkup(sentence);
    if (!cleanSentence.toLowerCase().includes(phrase.toLowerCase()) && !extractClozePhrase(sentence)) {
      warnings.push(
        `Baris ${rowNum} ("${phrase}"): frasa tidak persis muncul di kalimat, namun kartu tetap diimpor.`
      );
    }

    const hasAlternate = practiceSentence && getStudySentences({ sentence, phrase, practiceSentence }).hasAlternate;
    if (practiceSentence && !hasAlternate) {
      warnings.push(`Baris ${rowNum} ("${phrase}"): kalimat Tebak Kata harus memuat bentuk kata yang sama. Kalimat Listening akan dipakai.`);
    }

    cards.push({
      id: `${idPrefix}-${idx + 1}`,
      deckId: options.deckId,
      phrase,
      sentence,
      ...(sentenceTranslationId ? { sentenceTranslationId } : {}),
      ...(hasAlternate ? { practiceSentence } : {}),
      ipa: ipa || '',
      definitionEn: definitionEn || `Useful English expression: "${phrase}".`,
      translationId: translationId || 'Belum ada arti Indonesia',
      partOfSpeech,
      cefr,
      notes,
      isCustom: true,
      createdAt: nowIso,
    });
  });

  return {
    cards,
    warnings,
    delimiter,
    hasHeader,
  };
}
