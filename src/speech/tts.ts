import type { ElevenLabsSettings, SpeechAccent, SpeechRate, TtsProvider } from '../types';
import { buildAudioCacheKey, getCachedAudio, putCachedAudio } from './audioCache';
import {
  ElevenLabsTtsError,
  getDefaultElevenLabsSettings,
  getVoiceIdForAccent,
  loadElevenLabsApiKey,
  synthesizeElevenLabsAudio,
} from './elevenlabs';

export interface SpeakOptions {
  text: string;
  accent: SpeechAccent;
  rate: SpeechRate;
  provider?: TtsProvider;
  elevenLabs?: ElevenLabsSettings;
  apiKey?: string;
  onLoading?: (loading: boolean) => void;
  onStart?: (activeProvider: TtsProvider) => void;
  onEnd?: () => void;
  onFallback?: (reason: string) => void;
  onError?: () => void;
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeAbortController: AbortController | null = null;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  accent: SpeechAccent
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const exactLang = accent.toLowerCase();
  const exactMatches = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === exactLang);

  const scoreVoice = (voice: SpeechSynthesisVoice): number => {
    const name = voice.name.toLowerCase();
    let score = 0;
    if (name.includes('natural') || name.includes('neural')) score += 40;
    if (name.includes('google') || name.includes('microsoft')) score += 25;
    if (
      accent === 'en-GB' &&
      (name.includes('uk') ||
        name.includes('british') ||
        name.includes('libby') ||
        name.includes('sonia') ||
        name.includes('ryan') ||
        name.includes('daniel'))
    ) {
      score += 20;
    }
    if (
      accent === 'en-US' &&
      (name.includes('us') ||
        name.includes('american') ||
        name.includes('aria') ||
        name.includes('jenny') ||
        name.includes('samantha'))
    ) {
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

function cleanupHtmlAudio(): void {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.src = '';
    } catch {
      // Ignore cleanup errors
    }
    activeAudioElement = null;
  }
  if (activeObjectUrl) {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {
      // Ignore
    }
    activeObjectUrl = null;
  }
}

export function stopSpeaking(): void {
  cleanupHtmlAudio();
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech synthesis cancel exceptions
  }
}

function speakWithBrowser({
  text,
  accent,
  rate,
  onStart,
  onEnd,
  onError,
}: Pick<SpeakOptions, 'text' | 'accent' | 'rate' | 'onStart' | 'onEnd' | 'onError'>): boolean {
  if (!isSpeechSupported()) {
    onError?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    utterance.rate = rate;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const chosen = pickBestVoice(voices, accent);
    if (chosen) {
      utterance.voice = chosen;
    }

    utterance.onstart = () => onStart?.('browser');
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onError?.();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onError?.();
    return false;
  }
}

async function playAudioBlob(
  blob: Blob,
  callbacks: Pick<SpeakOptions, 'onStart' | 'onEnd' | 'onError'>
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    callbacks.onError?.();
    return false;
  }

  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  activeObjectUrl = objectUrl;
  activeAudioElement = audio;

  audio.onended = () => {
    if (activeAudioElement === audio) {
      cleanupHtmlAudio();
    }
    callbacks.onEnd?.();
  };

  audio.onerror = () => {
    if (activeAudioElement === audio) {
      cleanupHtmlAudio();
    }
    callbacks.onError?.();
  };

  try {
    callbacks.onStart?.('elevenlabs');
    await audio.play();
    return true;
  } catch {
    if (activeAudioElement === audio) {
      cleanupHtmlAudio();
    }
    callbacks.onError?.();
    return false;
  }
}

/**
 * Unified English pronunciation engine.
 * - Uses ElevenLabs studio voices + persistent local audio cache when `provider === 'elevenlabs'`.
 * - Automatically falls back to Web Speech API (`en-GB` / `en-US`) on any network/auth/quota error
 *   so morning review sessions never get stuck.
 */
export async function speakEnglish(options: SpeakOptions): Promise<boolean> {
  const cleanText = options.text.trim();
  if (!cleanText) {
    options.onEnd?.();
    return false;
  }

  stopSpeaking();

  const provider = options.provider ?? 'browser';
  if (provider !== 'elevenlabs') {
    return speakWithBrowser({
      text: cleanText,
      accent: options.accent,
      rate: options.rate,
      onStart: options.onStart,
      onEnd: options.onEnd,
      onError: options.onError,
    });
  }

  const elSettings = options.elevenLabs ?? getDefaultElevenLabsSettings();
  const voiceId = getVoiceIdForAccent(elSettings, options.accent);
  const cacheKey = buildAudioCacheKey({
    modelId: elSettings.modelId,
    voiceId,
    rate: options.rate,
    text: cleanText,
  });

  // 1. Instant cached playback (0 credits, ~0ms latency)
  const cachedBlob = await getCachedAudio(cacheKey);
  if (cachedBlob) {
    return playAudioBlob(cachedBlob, options);
  }

  // 2. Fetch fresh studio audio via proxy
  const controller = new AbortController();
  activeAbortController = controller;
  options.onLoading?.(true);

  try {
    const apiKey = options.apiKey !== undefined ? options.apiKey : loadElevenLabsApiKey();
    const blob = await synthesizeElevenLabsAudio({
      text: cleanText,
      voiceId,
      modelId: elSettings.modelId,
      rate: options.rate,
      apiKey,
      customProxyUrl: elSettings.customProxyUrl,
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      options.onLoading?.(false);
      return false;
    }

    await putCachedAudio(cacheKey, blob);
    options.onLoading?.(false);
    return playAudioBlob(blob, options);
  } catch (err) {
    options.onLoading?.(false);
    if (err instanceof ElevenLabsTtsError && err.code === 'aborted') {
      return false;
    }

    const reason =
      err instanceof ElevenLabsTtsError
        ? err.message
        : 'Suara ElevenLabs tidak tersedia — otomatis beralih ke suara browser.';
    options.onFallback?.(reason);

    return speakWithBrowser({
      text: cleanText,
      accent: options.accent,
      rate: options.rate,
      onStart: options.onStart,
      onEnd: options.onEnd,
      onError: options.onError,
    });
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
  }
}

/**
 * Quietly pre-warms the cache for the next card's sentence when using ElevenLabs
 * (especially helpful in Listening First mode for instant transitions).
 */
export async function prefetchElevenLabsAudio(params: {
  text: string;
  accent: SpeechAccent;
  rate: SpeechRate;
  elevenLabs: ElevenLabsSettings;
  apiKey?: string;
}): Promise<void> {
  const cleanText = params.text.trim();
  if (!cleanText) return;

  const voiceId = getVoiceIdForAccent(params.elevenLabs, params.accent);
  const cacheKey = buildAudioCacheKey({
    modelId: params.elevenLabs.modelId,
    voiceId,
    rate: params.rate,
    text: cleanText,
  });

  const existing = await getCachedAudio(cacheKey);
  if (existing) return;

  try {
    const apiKey = params.apiKey !== undefined ? params.apiKey : loadElevenLabsApiKey();
    const blob = await synthesizeElevenLabsAudio({
      text: cleanText,
      voiceId,
      modelId: params.elevenLabs.modelId,
      rate: params.rate,
      apiKey,
      customProxyUrl: params.elevenLabs.customProxyUrl,
    });
    await putCachedAudio(cacheKey, blob);
  } catch {
    // Silent prefetch failure — main playback handles fallback gracefully
  }
}
