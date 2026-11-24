import type { SpeechAccent, SpeechRate } from '../types';

export interface SpeakOptions {
  text: string;
  accent: SpeechAccent;
  rate: SpeechRate;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickBestVoice(voices: SpeechSynthesisVoice[], accent: SpeechAccent): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const exactLang = accent.toLowerCase();
  const exactMatches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === exactLang);

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (name.includes('natural') || name.includes('neural')) score += 40;
    if (name.includes('google') || name.includes('microsoft')) score += 25;
    if (accent === 'en-GB' && (name.includes('uk') || name.includes('british') || name.includes('libby') || name.includes('sonia') || name.includes('ryan') || name.includes('daniel'))) {
      score += 20;
    }
    if (accent === 'en-US' && (name.includes('us') || name.includes('american') || name.includes('aria') || name.includes('jenny') || name.includes('samantha'))) {
      score += 20;
    }
    if (voice.localService) score += 5;
    return score;
  };

  if (exactMatches.length > 0) {
    return [...exactMatches].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  const englishMatches = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (englishMatches.length > 0) {
    return [...englishMatches].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  return null;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech synthesis cancel exceptions
  }
}

export function speakEnglish({ text, accent, rate, onStart, onEnd, onError }: SpeakOptions): boolean {
  if (!isSpeechSupported()) {
    onError?.();
    return false;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    onEnd?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = accent;
    utterance.rate = rate;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const chosen = pickBestVoice(voices, accent);
    if (chosen) {
      utterance.voice = chosen;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onError?.();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onError?.();
    return false;
  }
}
