import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleElevenLabsProxyRequest } from '../../server/elevenlabsProxy';
import {
  buildAudioCacheKey,
  clearAudioCache,
  getCachedAudio,
  getCachedAudioCount,
  putCachedAudio,
} from './audioCache';
import {
  DEFAULT_UK_VOICE_ID,
  DEFAULT_US_VOICE_ID,
  ELEVENLABS_SECRET_STORAGE_KEY,
  ELEVENLABS_VOICES,
  ElevenLabsTtsError,
  getDefaultElevenLabsSettings,
  getVoiceIdForAccent,
  isElevenLabsConfigured,
  loadElevenLabsApiKey,
  saveElevenLabsApiKey,
  synthesizeElevenLabsAudio,
} from './elevenlabs';
import {
  createPersonalDeck,
  LEARNING_PHASES,
  STARTER_CARDS,
  STARTER_DECKS,
} from '../data';
import { serializeBackup } from '../importExport/backup';
import { createInitialAppState, type StorageLike } from '../storage/state';
import { speakEnglish } from './tts';

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

function createMockReq(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  bodyText?: string
): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage;
  emitter.method = method;
  emitter.url = url;
  emitter.headers = headers;

  queueMicrotask(() => {
    if (bodyText !== undefined) {
      emitter.emit('data', Buffer.from(bodyText, 'utf8'));
    }
    emitter.emit('end');
  });

  return emitter;
}

function createMockRes() {
  const headers: Record<string, string> = {};
  let bodyBuffer: Buffer = Buffer.alloc(0);

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: Buffer | string) {
      if (chunk) {
        bodyBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
      }
    },
  } as unknown as ServerResponse;

  return {
    res,
    getStatus: () => res.statusCode,
    getHeaders: () => headers,
    getJson: () => JSON.parse(bodyBuffer.toString('utf8')) as Record<string, unknown>,
    getBuffer: () => bodyBuffer,
  };
}

describe('ElevenLabs Server Proxy Middleware', () => {
  it('reports serverConfigured status without exposing secrets', async () => {
    const req = createMockReq('GET', '/api/tts/status');
    const mock = createMockRes();
    const handled = await handleElevenLabsProxyRequest(req, mock.res, {
      serverApiKey: 'sk_test_secret_123',
    });

    expect(handled).toBe(true);
    expect(mock.getStatus()).toBe(200);
    expect(mock.getJson()).toEqual({
      provider: 'elevenlabs',
      serverConfigured: true,
    });
  });

  it('rejects requests when neither server env nor header API key is provided', async () => {
    const req = createMockReq(
      'POST',
      '/api/tts/elevenlabs',
      {},
      JSON.stringify({ text: 'Hello world', voiceId: DEFAULT_UK_VOICE_ID })
    );
    const mock = createMockRes();

    await handleElevenLabsProxyRequest(req, mock.res, { serverApiKey: '' });
    expect(mock.getStatus()).toBe(401);
    expect(mock.getJson().code).toBe('missing_key');
  });

  it('rejects unsafe voiceId values to prevent upstream path injection', async () => {
    const req = createMockReq(
      'POST',
      '/api/tts/elevenlabs',
      {},
      JSON.stringify({ text: 'Hello', voiceId: '../admin/keys' })
    );
    const mock = createMockRes();

    await handleElevenLabsProxyRequest(req, mock.res, { serverApiKey: 'sk_valid' });
    expect(mock.getStatus()).toBe(400);
    expect(mock.getJson().code).toBe('bad_request');
  });

  it('forwards valid TTS request to ElevenLabs with clamped speed and returns audio/mpeg', async () => {
    const fakeMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00]);
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(fakeMp3, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    );

    const req = createMockReq(
      'POST',
      '/api/tts/elevenlabs',
      { 'x-elevenlabs-api-key': 'sk_byok_header_key' },
      JSON.stringify({
        text: 'It took me a few weeks to get used to waking up early.',
        voiceId: DEFAULT_UK_VOICE_ID,
        modelId: 'eleven_flash_v2_5',
        rate: 0.8,
      })
    );
    const mock = createMockRes();

    await handleElevenLabsProxyRequest(req, mock.res, {
      serverApiKey: '',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mock.getStatus()).toBe(200);
    expect(mock.getHeaders()['content-type']).toContain('audio/mpeg');
    expect(mock.getBuffer().length).toBe(fakeMp3.length);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain(`/v1/text-to-speech/${DEFAULT_UK_VOICE_ID}`);
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('sk_byok_header_key');
    const sentBody = JSON.parse(String(init.body)) as {
      model_id: string;
      voice_settings: { speed: number };
    };
    expect(sentBody.model_id).toBe('eleven_flash_v2_5');
    expect(sentBody.voice_settings.speed).toBe(0.8);
  });

  it('maps upstream 429 quota errors cleanly', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429 }));
    const req = createMockReq(
      'POST',
      '/api/tts/elevenlabs',
      {},
      JSON.stringify({ text: 'Fair enough.', voiceId: DEFAULT_UK_VOICE_ID })
    );
    const mock = createMockRes();

    await handleElevenLabsProxyRequest(req, mock.res, {
      serverApiKey: 'sk_key',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(mock.getStatus()).toBe(429);
    expect(mock.getJson().code).toBe('quota_exceeded');
  });
});

describe('ElevenLabs Client, Key Isolation & Audio Cache', () => {
  beforeEach(async () => {
    await clearAudioCache();
  });

  it('keeps BYOK API keys strictly isolated from AppState and JSON backups', () => {
    const storage = createMemoryStorage();
    saveElevenLabsApiKey('sk_super_private_999', storage);

    expect(loadElevenLabsApiKey(storage)).toBe('sk_super_private_999');
    expect(storage.getItem(ELEVENLABS_SECRET_STORAGE_KEY)).toBe('sk_super_private_999');

    const backupJson = serializeBackup(createInitialAppState());
    expect(backupJson).not.toContain('sk_super_private_999');

    const defaults = getDefaultElevenLabsSettings();
    expect(getVoiceIdForAccent(defaults, 'en-GB')).toBe(DEFAULT_UK_VOICE_ID);
    expect(getVoiceIdForAccent(defaults, 'en-US')).toBe(DEFAULT_US_VOICE_ID);
  });

  it('synthesizes audio blobs and throws typed ElevenLabsTtsError on 401/429', async () => {
    const okFetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    );

    const blob = await synthesizeElevenLabsAudio({
      text: 'In a nutshell.',
      voiceId: DEFAULT_UK_VOICE_ID,
      modelId: 'eleven_flash_v2_5',
      rate: 1.0,
      apiKey: 'sk_test',
      fetchImpl: okFetch as unknown as typeof fetch,
    });
    expect(blob.size).toBe(4);

    const authFailFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized', error: 'Invalid key' }), { status: 401 })
    );

    await expect(
      synthesizeElevenLabsAudio({
        text: 'In a nutshell.',
        voiceId: DEFAULT_UK_VOICE_ID,
        modelId: 'eleven_flash_v2_5',
        rate: 1.0,
        apiKey: 'sk_bad',
        fetchImpl: authFailFetch as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({
      name: 'ElevenLabsTtsError',
      code: 'unauthorized',
    } satisfies Partial<ElevenLabsTtsError>);
  });

  it('caches synthesized clips cleanly by model, voice, rate, and normalized text', async () => {
    const key1 = buildAudioCacheKey({
      modelId: 'eleven_flash_v2_5',
      voiceId: DEFAULT_UK_VOICE_ID,
      rate: 1.0,
      text: '  Fair   enough. ',
    });
    const key2 = buildAudioCacheKey({
      modelId: 'eleven_flash_v2_5',
      voiceId: DEFAULT_UK_VOICE_ID,
      rate: 1.0,
      text: 'Fair enough.',
    });
    expect(key1).toBe(key2);

    const sampleBlob = new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mpeg' });
    await putCachedAudio(key1, sampleBlob);

    const hit = await getCachedAudio(key2);
    expect(hit).not.toBeNull();
    expect(hit?.size).toBe(3);
    expect(await getCachedAudioCount()).toBe(1);

    await clearAudioCache();
    expect(await getCachedAudio(key1)).toBeNull();
    expect(await getCachedAudioCount()).toBe(0);
  });

  it('automatically triggers fallback callback when ElevenLabs synthesis fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const onFallback = vi.fn();
    const onLoading = vi.fn();
    try {
      await speakEnglish({
        text: 'A blessing in disguise.',
        accent: 'en-GB',
        rate: 1.0,
        provider: 'elevenlabs',
        elevenLabs: getDefaultElevenLabsSettings(),
        apiKey: 'sk_test_offline',
        onLoading,
        onFallback,
      });

      expect(onLoading).toHaveBeenCalledWith(true);
      expect(onLoading).toHaveBeenCalledWith(false);
      expect(onFallback).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Default US Accent, ElevenLabs Configuration & Brand/Arrow-Free Copy', () => {
  it('defaults initial user settings to American (en-US) accent', () => {
    const initial = createInitialAppState();
    expect(initial.settings.accent).toBe('en-US');
    expect(initial.settings.ttsProvider).toBe('browser');
  });

  it('reports ElevenLabs configured only when server key, custom proxy, or local key exists', () => {
    const defaults = getDefaultElevenLabsSettings();

    expect(
      isElevenLabsConfigured({ available: true, serverConfigured: false }, defaults, false)
    ).toBe(false);

    expect(
      isElevenLabsConfigured({ available: true, serverConfigured: true }, defaults, false)
    ).toBe(true);

    expect(
      isElevenLabsConfigured(
        { available: true, serverConfigured: false },
        { ...defaults, customProxyUrl: 'https://proxy.example.com/tts' },
        false
      )
    ).toBe(true);

    expect(
      isElevenLabsConfigured({ available: true, serverConfigured: false }, defaults, true)
    ).toBe(true);
  });

  it('contains zero bullet/dot/arrow symbols and zero product/publisher branding in visible curriculum and voice data', () => {
    const forbidden = /→|•|·|PagiKata|\bBBC\b|\bOxford\b/i;

    for (const phase of LEARNING_PHASES) {
      expect(phase.title).not.toMatch(forbidden);
      expect(phase.cefrTarget).not.toMatch(forbidden);
      expect(phase.curriculumLabel).not.toMatch(forbidden);
      expect(phase.monthsLabel).not.toMatch(forbidden);
      expect(phase.description).not.toMatch(forbidden);
    }

    for (const deck of [...STARTER_DECKS, createPersonalDeck()]) {
      expect(deck.title).not.toMatch(forbidden);
      expect(deck.subtitle).not.toMatch(forbidden);
      expect(deck.description).not.toMatch(forbidden);
      expect(deck.phaseLabel).not.toMatch(forbidden);
    }

    for (const card of STARTER_CARDS) {
      expect(card.sentence).not.toMatch(forbidden);
      expect(card.notes).not.toMatch(forbidden);
    }

    for (const voice of ELEVENLABS_VOICES) {
      expect(voice.name).not.toMatch(forbidden);
      expect(voice.styleLabel).not.toMatch(forbidden);
    }
  });
});
