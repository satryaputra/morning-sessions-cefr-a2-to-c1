import { describe, expect, it, vi } from 'vitest';
import { handleWorkerFetch, type WorkerEnv } from './index';

const VALID_VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';

function createEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    ASSETS: {
      fetch: vi.fn(async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200 })),
    },
    ...overrides,
  };
}

describe('Cloudflare Worker (handleWorkerFetch)', () => {
  describe('GET /api/tts/status', () => {
    it('returns serverConfigured: true when ELEVENLABS_API_KEY is set', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: '  sk_worker_secret  ' });
      const res = await handleWorkerFetch(new Request('https://example.com/api/tts/status'), env);

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({
        provider: 'elevenlabs',
        serverConfigured: true,
      });
    });

    it('returns serverConfigured: false when ELEVENLABS_API_KEY is missing or blank', async () => {
      const envMissing = createEnv();
      const resMissing = await handleWorkerFetch(new Request('https://example.com/api/tts/status'), envMissing);
      expect(resMissing.status).toBe(200);
      expect(await resMissing.json()).toEqual({
        provider: 'elevenlabs',
        serverConfigured: false,
      });

      const envBlank = createEnv({ ELEVENLABS_API_KEY: '   ' });
      const resBlank = await handleWorkerFetch(new Request('https://example.com/api/tts/status'), envBlank);
      expect(resBlank.status).toBe(200);
      expect(await resBlank.json()).toEqual({
        provider: 'elevenlabs',
        serverConfigured: false,
      });
    });

    it('returns 405 for non-GET requests', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });
      const res = await handleWorkerFetch(
        new Request('https://example.com/api/tts/status', { method: 'POST' }),
        env
      );

      expect(res.status).toBe(405);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ error: 'Method not allowed' });
    });
  });

  describe('POST /api/tts/elevenlabs', () => {
    it('returns 405 for non-POST requests', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });
      const res = await handleWorkerFetch(
        new Request('https://example.com/api/tts/elevenlabs', { method: 'GET' }),
        env
      );

      expect(res.status).toBe(405);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('rejects cross-origin requests with 403 forbidden_origin', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });
      const res = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          headers: {
            Origin: 'https://evil.example.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'Hello world', voiceId: VALID_VOICE_ID }),
        }),
        env
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        code: 'forbidden_origin',
        error: 'Permintaan lintas origin tidak diizinkan.',
      });
    });

    it('returns 401 missing_key when neither server secret nor header key is present', async () => {
      const env = createEnv();
      const res = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          headers: { Origin: 'https://app.example.com' },
          body: JSON.stringify({ text: 'Hello world', voiceId: VALID_VOICE_ID }),
        }),
        env
      );

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        code: 'missing_key',
        error: 'API key ElevenLabs belum diatur di server maupun Setelan Suara.',
      });
    });

    it('returns 413 when Content-Length or actual UTF-8 body exceeds 16,384 bytes', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });

      const largeHeaderRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          headers: { 'Content-Length': '20000' },
          body: JSON.stringify({ text: 'short', voiceId: VALID_VOICE_ID }),
        }),
        env
      );
      expect(largeHeaderRes.status).toBe(413);
      expect(await largeHeaderRes.json()).toEqual({
        code: 'bad_request',
        error: 'Teks terlalu panjang.',
      });

      const oversizedBody = JSON.stringify({
        text: 'a'.repeat(17_000),
        voiceId: VALID_VOICE_ID,
      });
      const largeBodyRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: oversizedBody,
        }),
        env
      );
      expect(largeBodyRes.status).toBe(413);
      expect(await largeBodyRes.json()).toEqual({
        code: 'bad_request',
        error: 'Teks terlalu panjang.',
      });
    });

    it('returns 400 for invalid JSON, empty/too-long text, or invalid voiceId', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });

      const invalidJsonRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: '{not valid json',
        }),
        env
      );
      expect(invalidJsonRes.status).toBe(400);
      expect(await invalidJsonRes.json()).toEqual({
        code: 'bad_request',
        error: 'Payload JSON tidak valid.',
      });

      const emptyTextRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: JSON.stringify({ text: '   ', voiceId: VALID_VOICE_ID }),
        }),
        env
      );
      expect(emptyTextRes.status).toBe(400);
      expect((await emptyTextRes.json()).code).toBe('bad_request');

      const longTextRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: JSON.stringify({ text: 'x'.repeat(1001), voiceId: VALID_VOICE_ID }),
        }),
        env
      );
      expect(longTextRes.status).toBe(400);
      expect((await longTextRes.json()).code).toBe('bad_request');

      const badVoiceRes = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: JSON.stringify({ text: 'Hello world', voiceId: '../admin/keys' }),
        }),
        env
      );
      expect(badVoiceRes.status).toBe(400);
      expect((await badVoiceRes.json()).code).toBe('bad_request');
    });

    it('maps upstream 401/403, 429, other errors, and network errors accurately', async () => {
      const env = createEnv({ ELEVENLABS_API_KEY: 'sk_test' });
      const makeRequest = () =>
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          body: JSON.stringify({ text: 'Fair enough.', voiceId: VALID_VOICE_ID }),
        });

      const res401 = await handleWorkerFetch(
        makeRequest(),
        env,
        vi.fn().mockResolvedValue(new Response('denied', { status: 403 })) as unknown as typeof fetch
      );
      expect(res401.status).toBe(401);
      expect((await res401.json()).code).toBe('unauthorized');

      const res429 = await handleWorkerFetch(
        makeRequest(),
        env,
        vi.fn().mockResolvedValue(new Response('rate limit', { status: 429 })) as unknown as typeof fetch
      );
      expect(res429.status).toBe(429);
      expect((await res429.json()).code).toBe('quota_exceeded');

      const res502 = await handleWorkerFetch(
        makeRequest(),
        env,
        vi.fn().mockResolvedValue(new Response('bad gateway', { status: 500 })) as unknown as typeof fetch
      );
      expect(res502.status).toBe(502);
      expect((await res502.json()).code).toBe('upstream_error');

      const resNetwork = await handleWorkerFetch(
        makeRequest(),
        env,
        vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch
      );
      expect(resNetwork.status).toBe(502);
      expect((await resNetwork.json()).code).toBe('network_error');
    });

    it('synthesizes audio on happy path with clamped speed and returns audio/mpeg', async () => {
      const fakeMp3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00]);
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(fakeMp3, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      );
      const env = createEnv();

      const res = await handleWorkerFetch(
        new Request('https://app.example.com/api/tts/elevenlabs', {
          method: 'POST',
          headers: {
            Origin: 'https://app.example.com',
            'x-elevenlabs-api-key': 'sk_byok_key',
          },
          body: JSON.stringify({
            text: '  It took me a while to get used to it.  ',
            voiceId: VALID_VOICE_ID,
            modelId: 'eleven_multilingual_v2',
            rate: 1.5,
          }),
        }),
        env,
        mockFetch as unknown as typeof fetch
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      expect(res.headers.get('cache-control')).toBe('private, max-age=86400');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(fakeMp3);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(
        `https://api.elevenlabs.io/v1/text-to-speech/${VALID_VOICE_ID}?output_format=mp3_44100_128`
      );
      expect(init.headers).toEqual({
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': 'sk_byok_key',
      });
      expect(JSON.parse(String(init.body))).toEqual({
        text: 'It took me a while to get used to it.',
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.78,
          style: 0.08,
          use_speaker_boost: true,
          speed: 1.2,
        },
      });
    });
  });

  describe('Fallback routing', () => {
    it('returns 404 JSON for unknown /api/* routes', async () => {
      const env = createEnv();
      const res = await handleWorkerFetch(new Request('https://app.example.com/api/unknown'), env);

      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ error: 'Not found' });
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    });

    it('delegates non-/api/* requests to env.ASSETS.fetch', async () => {
      const env = createEnv();
      const req = new Request('https://app.example.com/settings');
      const res = await handleWorkerFetch(req, env);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('asset:/settings');
      expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
      expect(env.ASSETS.fetch).toHaveBeenCalledWith(req);
    });
  });
});
