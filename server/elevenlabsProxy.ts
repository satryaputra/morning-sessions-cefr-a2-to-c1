import type { IncomingMessage, ServerResponse } from 'node:http';

export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const VOICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const ALLOWED_MODELS = new Set(['eleven_flash_v2_5', 'eleven_multilingual_v2']);
const MAX_TEXT_LENGTH = 1000;

export interface ElevenLabsProxyRequestBody {
  text?: unknown;
  voiceId?: unknown;
  modelId?: unknown;
  rate?: unknown;
}

export interface ElevenLabsProxyOptions {
  serverApiKey?: string;
  fetchImpl?: typeof fetch;
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readRequestBody(req: IncomingMessage, maxBytes = 16_384): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer | string) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      total += buf.length;
      if (total > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

function clampSpeed(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1.0;
  return Math.min(1.2, Math.max(0.7, Math.round(value * 100) / 100));
}

/**
 * Handles same-origin /api/tts/status and /api/tts/elevenlabs requests
 * for both Vite dev and Vite preview servers so API keys stay off client bundles
 * and browser CORS restrictions are avoided cleanly.
 */
export async function handleElevenLabsProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: ElevenLabsProxyOptions = {}
): Promise<boolean> {
  const rawUrl = req.url ?? '';
  const pathname = rawUrl.split('?')[0];

  if (pathname === '/api/tts/status') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }

    const hasServerKey = Boolean(options.serverApiKey && options.serverApiKey.trim().length > 0);
    sendJson(res, 200, {
      provider: 'elevenlabs',
      serverConfigured: hasServerKey,
    });
    return true;
  }

  if (pathname !== '/api/tts/elevenlabs') {
    return false;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }

  const headerKeyRaw = req.headers['x-elevenlabs-api-key'];
  const headerKey = Array.isArray(headerKeyRaw) ? headerKeyRaw[0] : headerKeyRaw;
  const apiKey = (options.serverApiKey?.trim() || headerKey?.trim() || '');

  if (!apiKey) {
    sendJson(res, 401, {
      code: 'missing_key',
      error: 'API key ElevenLabs belum diatur di .env.local maupun Pengaturan Suara.',
    });
    return true;
  }

  let body: ElevenLabsProxyRequestBody;
  try {
    const raw = await readRequestBody(req);
    body = JSON.parse(raw) as ElevenLabsProxyRequestBody;
  } catch (err) {
    const isTooLarge = err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE';
    sendJson(res, isTooLarge ? 413 : 400, {
      code: 'bad_request',
      error: isTooLarge ? 'Teks terlalu panjang.' : 'Payload JSON tidak valid.',
    });
    return true;
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
  const modelId =
    typeof body.modelId === 'string' && ALLOWED_MODELS.has(body.modelId)
      ? body.modelId
      : 'eleven_flash_v2_5';
  const speed = clampSpeed(body.rate);

  if (!text || text.length > MAX_TEXT_LENGTH) {
    sendJson(res, 400, {
      code: 'bad_request',
      error: 'Teks audio wajib diisi (maksimal 1000 karakter).',
    });
    return true;
  }

  if (!VOICE_ID_PATTERN.test(voiceId)) {
    sendJson(res, 400, {
      code: 'bad_request',
      error: 'Voice ID ElevenLabs tidak valid.',
    });
    return true;
  }

  const fetcher = options.fetchImpl ?? globalThis.fetch;

  try {
    const upstreamUrl = `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
    const upstream = await fetcher(upstreamUrl, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.78,
          style: 0.08,
          use_speaker_boost: true,
          speed,
        },
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        sendJson(res, 401, {
          code: 'unauthorized',
          error: 'API key ElevenLabs ditolak atau tidak valid.',
        });
        return true;
      }
      if (upstream.status === 429) {
        sendJson(res, 429, {
          code: 'quota_exceeded',
          error: 'Kuota atau batas permintaan ElevenLabs sementara tercapai.',
        });
        return true;
      }
      sendJson(res, 502, {
        code: 'upstream_error',
        error: `ElevenLabs mengembalikan status ${upstream.status}.`,
      });
      return true;
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Content-Length', String(audioBuffer.length));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(audioBuffer);
    return true;
  } catch {
    sendJson(res, 502, {
      code: 'network_error',
      error: 'Gagal menghubungi server ElevenLabs. Periksa koneksi internet Anda.',
    });
    return true;
  }
}
