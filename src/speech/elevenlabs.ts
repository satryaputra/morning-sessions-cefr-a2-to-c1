import type { ElevenLabsModelId, ElevenLabsSettings, SpeechAccent, SpeechRate } from '../types';
import type { StorageLike } from '../storage/state';

export const ELEVENLABS_SECRET_STORAGE_KEY = 'pagikata_elevenlabs_secret_v1';

export interface ElevenLabsVoiceOption {
  id: string;
  name: string;
  accent: SpeechAccent;
  gender: 'Perempuan' | 'Laki-laki';
  styleLabel: string;
}

export interface ElevenLabsModelOption {
  id: ElevenLabsModelId;
  label: string;
  desc: string;
}

export const ELEVENLABS_VOICES: ElevenLabsVoiceOption[] = [
  {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Alice',
    accent: 'en-GB',
    gender: 'Perempuan',
    styleLabel: 'Jernih & hangat • Edukator UK',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    accent: 'en-GB',
    gender: 'Laki-laki',
    styleLabel: 'Tegas & artikulatif • Narator Berita UK',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    accent: 'en-GB',
    gender: 'Laki-laki',
    styleLabel: 'Tenang & berwibawa • Narator UK',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    accent: 'en-GB',
    gender: 'Perempuan',
    styleLabel: 'Ekspresif & lembut • Percakapan UK',
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    accent: 'en-US',
    gender: 'Perempuan',
    styleLabel: 'Natural & ramah • Percakapan US',
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    accent: 'en-US',
    gender: 'Laki-laki',
    styleLabel: 'Hangat & jernih • Narator US',
  },
  {
    id: 'cjVigY5qzO86Huf0OWal',
    name: 'Eric',
    accent: 'en-US',
    gender: 'Laki-laki',
    styleLabel: 'Profesional & tenang • Diskusi US',
  },
];

export const ELEVENLABS_MODELS: ElevenLabsModelOption[] = [
  {
    id: 'eleven_flash_v2_5',
    label: 'Flash v2.5 (Disarankan)',
    desc: 'Latensi super cepat (~75ms) & lebih hemat kuota karakter untuk review harian.',
  },
  {
    id: 'eleven_multilingual_v2',
    label: 'Multilingual v2 (Studio)',
    desc: 'Intonasi dan ekspresi paling kaya untuk latihan listening B2–C1.',
  },
];

export const DEFAULT_UK_VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice (UK)
export const DEFAULT_US_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah (US)

export function getDefaultElevenLabsSettings(): ElevenLabsSettings {
  return {
    modelId: 'eleven_flash_v2_5',
    ukVoiceId: DEFAULT_UK_VOICE_ID,
    usVoiceId: DEFAULT_US_VOICE_ID,
    customProxyUrl: '',
  };
}

export function getVoiceIdForAccent(settings: ElevenLabsSettings, accent: SpeechAccent): string {
  return accent === 'en-GB'
    ? settings.ukVoiceId || DEFAULT_UK_VOICE_ID
    : settings.usVoiceId || DEFAULT_US_VOICE_ID;
}

export function getVoiceLabelById(voiceId: string): string {
  const found = ELEVENLABS_VOICES.find((v) => v.id === voiceId);
  return found ? found.name : 'Suara Kustom';
}

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Stores user's optional BYOK ElevenLabs key strictly in a dedicated local key,
 * completely isolated from AppState and JSON backups.
 */
export function loadElevenLabsApiKey(storage: StorageLike | null = getBrowserStorage()): string {
  if (!storage) return '';
  try {
    return (storage.getItem(ELEVENLABS_SECRET_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function saveElevenLabsApiKey(
  apiKey: string,
  storage: StorageLike | null = getBrowserStorage()
): void {
  if (!storage) return;
  try {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      storage.removeItem(ELEVENLABS_SECRET_STORAGE_KEY);
    } else {
      storage.setItem(ELEVENLABS_SECRET_STORAGE_KEY, trimmed);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export type ElevenLabsErrorCode =
  | 'missing_key'
  | 'unauthorized'
  | 'quota_exceeded'
  | 'network'
  | 'aborted'
  | 'upstream';

export class ElevenLabsTtsError extends Error {
  code: ElevenLabsErrorCode;

  constructor(code: ElevenLabsErrorCode, message: string) {
    super(message);
    this.name = 'ElevenLabsTtsError';
    this.code = code;
  }
}

export interface ServerTtsStatus {
  available: boolean;
  serverConfigured: boolean;
}

export function isElevenLabsConfigured(
  serverStatus: ServerTtsStatus,
  elevenLabs: ElevenLabsSettings,
  hasLocalKey = false
): boolean {
  return (
    serverStatus.serverConfigured ||
    elevenLabs.customProxyUrl.trim().length > 0 ||
    hasLocalKey
  );
}

export async function checkServerTtsStatus(
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<ServerTtsStatus> {
  try {
    const resp = await fetchImpl('/api/tts/status', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      return { available: false, serverConfigured: false };
    }
    const data = (await resp.json()) as { serverConfigured?: boolean };
    return {
      available: true,
      serverConfigured: Boolean(data.serverConfigured),
    };
  } catch {
    return { available: false, serverConfigured: false };
  }
}

export interface SynthesizeElevenLabsParams {
  text: string;
  voiceId: string;
  modelId: ElevenLabsModelId;
  rate: SpeechRate;
  apiKey?: string;
  customProxyUrl?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * Calls the local Vite proxy (/api/tts/elevenlabs) or an optional user-configured proxy endpoint
 * to synthesize natural MP3 speech via ElevenLabs.
 */
export async function synthesizeElevenLabsAudio(
  params: SynthesizeElevenLabsParams
): Promise<Blob> {
  const fetcher = params.fetchImpl ?? globalThis.fetch;
  const endpoint = params.customProxyUrl?.trim() || '/api/tts/elevenlabs';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
  };

  if (params.apiKey?.trim()) {
    headers['x-elevenlabs-api-key'] = params.apiKey.trim();
  }

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: 'POST',
      headers,
      signal: params.signal,
      body: JSON.stringify({
        text: params.text.trim(),
        voiceId: params.voiceId,
        modelId: params.modelId,
        rate: params.rate,
      }),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ElevenLabsTtsError('aborted', 'Pemutaran audio dibatalkan.');
    }
    throw new ElevenLabsTtsError(
      'network',
      'Tidak dapat menghubungi proxy ElevenLabs. Beralih ke suara browser.'
    );
  }

  if (!response.ok) {
    let payload: { code?: string; error?: string } = {};
    try {
      payload = (await response.json()) as { code?: string; error?: string };
    } catch {
      // Non-JSON error body
    }

    if (response.status === 401 || response.status === 403) {
      const code: ElevenLabsErrorCode =
        payload.code === 'missing_key' ? 'missing_key' : 'unauthorized';
      throw new ElevenLabsTtsError(
        code,
        payload.error || 'API key ElevenLabs belum diatur atau tidak valid.'
      );
    }

    if (response.status === 429) {
      throw new ElevenLabsTtsError(
        'quota_exceeded',
        payload.error || 'Kuota ElevenLabs tercapai, sementara beralih ke suara browser.'
      );
    }

    throw new ElevenLabsTtsError(
      'upstream',
      payload.error || 'Layanan ElevenLabs sedang tidak merespons. Beralih ke suara browser.'
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new ElevenLabsTtsError('upstream', 'Audio kosong diterima dari ElevenLabs.');
  }
  return blob;
}
