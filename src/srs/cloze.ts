export interface SentenceSegment {
  type: 'text' | 'cloze';
  value: string;
}

export interface ParsedCloze {
  cleanSentence: string;
  targetPhrase: string;
  segments: SentenceSegment[];
  hasMatch: boolean;
}

const CLOZE_REGEX = /\{\{([^{}]+)\}\}/g;

/**
 * Removes {{...}} markup from a sentence while keeping the inner phrase intact.
 */
export function stripClozeMarkup(sentence: string): string {
  return sentence.replace(CLOZE_REGEX, '$1').trim();
}

/**
 * Extracts the first {{...}} cloze phrase from a sentence if present.
 */
export function extractClozePhrase(sentence: string): string | null {
  const match = /\{\{([^{}]+)\}\}/.exec(sentence);
  return match ? match[1].trim() : null;
}

/**
 * Wraps the first match of `phrase` in `sentence` with {{...}} for Quick Cloze editing.
 */
export function applyClozeMarkup(sentence: string, phrase: string): string {
  const clean = stripClozeMarkup(sentence);
  const trimmedPhrase = phrase.trim();
  if (!trimmedPhrase) return clean;

  const escaped = escapeRegExp(trimmedPhrase);
  const regex = new RegExp(`(${escaped})`, 'i');
  if (!regex.test(clean)) {
    return clean;
  }
  return clean.replace(regex, '{{$1}}');
}

/**
 * Parses a sentence and target phrase into segments so UI can render either
 * cloze blanks (front) or highlighted target phrase (back).
 *
 * Priority:
 * 1. Explicit {{...}} cloze markers inside `sentence`
 * 2. Case-insensitive match of `phrase` inside `sentence` (preferring word boundaries)
 * 3. Graceful fallback if phrase does not appear literally in the sentence
 */
export function parseClozeSentence(sentence: string, phrase: string): ParsedCloze {
  const trimmedSentence = sentence.trim();
  const trimmedPhrase = phrase.trim();

  if (CLOZE_REGEX.test(trimmedSentence)) {
    CLOZE_REGEX.lastIndex = 0;
    const segments: SentenceSegment[] = [];
    let lastIndex = 0;
    let firstTarget = trimmedPhrase;
    let match: RegExpExecArray | null;

    while ((match = CLOZE_REGEX.exec(trimmedSentence)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          value: trimmedSentence.slice(lastIndex, match.index),
        });
      }
      const captured = match[1].trim();
      if (!firstTarget) {
        firstTarget = captured;
      }
      segments.push({
        type: 'cloze',
        value: captured,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < trimmedSentence.length) {
      segments.push({
        type: 'text',
        value: trimmedSentence.slice(lastIndex),
      });
    }

    return {
      cleanSentence: stripClozeMarkup(trimmedSentence),
      targetPhrase: firstTarget || trimmedPhrase,
      segments,
      hasMatch: true,
    };
  }

  if (!trimmedPhrase) {
    return {
      cleanSentence: trimmedSentence,
      targetPhrase: '',
      segments: [{ type: 'text', value: trimmedSentence }],
      hasMatch: false,
    };
  }

  const escaped = escapeRegExp(trimmedPhrase);
  // Try whole-word / phrase boundary match first, then substring fallback
  const boundaryRegex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
  const fallbackRegex = new RegExp(escaped, 'i');
  const match = boundaryRegex.exec(trimmedSentence) ?? fallbackRegex.exec(trimmedSentence);

  if (!match || match.index === undefined) {
    return {
      cleanSentence: trimmedSentence,
      targetPhrase: trimmedPhrase,
      segments: [{ type: 'text', value: trimmedSentence }],
      hasMatch: false,
    };
  }

  const segments: SentenceSegment[] = [];
  if (match.index > 0) {
    segments.push({
      type: 'text',
      value: trimmedSentence.slice(0, match.index),
    });
  }
  segments.push({
    type: 'cloze',
    value: match[0],
  });
  const endIndex = match.index + match[0].length;
  if (endIndex < trimmedSentence.length) {
    segments.push({
      type: 'text',
      value: trimmedSentence.slice(endIndex),
    });
  }

  return {
    cleanSentence: trimmedSentence,
    targetPhrase: match[0],
    segments,
    hasMatch: true,
  };
}

export function normalizeStudyAnswer(value: string): string {
  return value.normalize('NFC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getStudySentences(card: { sentence: string; phrase: string; practiceSentence?: string }) {
  const source = parseClozeSentence(card.sentence, card.phrase);
  const answer = source.segments.find((segment) => segment.type === 'cloze')?.value ?? source.targetPhrase;
  const markAnswer = (sentence: string) => {
    if (!answer) return parseClozeSentence(sentence, '');
    const exact = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(answer)}(?![\\p{L}\\p{N}])`, 'giu');
    const marked = sentence.replace(exact, '{{$&}}');
    return parseClozeSentence(marked, '');
  };
  const listening = markAnswer(source.cleanSentence);
  const alternate = typeof card.practiceSentence === 'string' && markAnswer(stripClozeMarkup(card.practiceSentence));
  return {
    answer,
    listening,
    cloze: alternate && alternate.hasMatch ? alternate : listening,
    hasAlternate: Boolean(alternate && alternate.hasMatch),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
