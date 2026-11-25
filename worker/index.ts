export const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const VOICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const ALLOWED_MODELS = new Set(['eleven_flash_v2_5', 'eleven_multilingual_v2']);
const MAX_TEXT_LENGTH = 1000;
const MAX_BODY_BYTES = 16_384;

export interface AssetsFetcher {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerEnv {
  ASSETS: AssetsFetcher;
  ELEVENLABS_API_KEY?: string;
}

export interface ElevenLabsProxyRequestBody {
  text?: unknown;
  voiceId?: unknown;
  modelId?: unknown;
  rate?: unknown;
}

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function clampSpeed(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1.0;
  return Math.min(1.2, Math.max(0.7, Math.round(value * 100) / 100));
}

async function handleTtsStatus(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  return jsonResponse(200, {
    provider: 'elevenlabs',
    serverConfigured: Boolean(env.ELEVENLABS_API_KEY?.trim()),
  });
}

async function handleElevenLabsTts(
  request: Request,
  url: URL,
  env: WorkerEnv,
  fetchImpl: typeof fetch
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return jsonResponse(403, {
      code: 'forbidden_origin',
      error: 'Permintaan lintas origin tidak diizinkan.',
    });
  }

  const apiKey =
    env.ELEVENLABS_API_KEY?.trim() || request.headers.get('x-elevenlabs-api-key')?.trim() || '';

  if (!apiKey) {
    return jsonResponse(401, {
      code: 'missing_key',
      error: 'API key ElevenLabs belum diatur di server maupun Setelan Suara.',
    });
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null && /^\d+$/.test(contentLengthHeader.trim())) {
    const contentLength = Number.parseInt(contentLengthHeader.trim(), 10);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(413, {
        code: 'bad_request',
        error: 'Teks terlalu panjang.',
      });
    }
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return jsonResponse(413, {
      code: 'bad_request',
      error: 'Teks terlalu panjang.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return jsonResponse(400, {
      code: 'bad_request',
      error: 'Payload JSON tidak valid.',
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return jsonResponse(400, {
      code: 'bad_request',
      error: 'Payload JSON tidak valid.',
    });
  }

  const body = parsed as ElevenLabsProxyRequestBody;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : '';
  const modelId =
    typeof body.modelId === 'string' && ALLOWED_MODELS.has(body.modelId)
      ? body.modelId
      : 'eleven_flash_v2_5';
  const speed = clampSpeed(body.rate);

  if (!text || text.length > MAX_TEXT_LENGTH) {
    return jsonResponse(400, {
      code: 'bad_request',
      error: 'Teks audio wajib diisi (maksimal 1000 karakter).',
    });
  }

  if (!VOICE_ID_PATTERN.test(voiceId)) {
    return jsonResponse(400, {
      code: 'bad_request',
      error: 'Voice ID ElevenLabs tidak valid.',
    });
  }

  try {
    const upstreamUrl = `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
    const upstream = await fetchImpl(upstreamUrl, {
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
        return jsonResponse(401, {
          code: 'unauthorized',
          error: 'API key ElevenLabs ditolak atau tidak valid.',
        });
      }
      if (upstream.status === 429) {
        return jsonResponse(429, {
          code: 'quota_exceeded',
          error: 'Kuota atau batas permintaan ElevenLabs sementara tercapai.',
        });
      }
      return jsonResponse(502, {
        code: 'upstream_error',
        error: `ElevenLabs mengembalikan status ${upstream.status}.`,
      });
    }

    const audioBytes = await upstream.arrayBuffer();
    return new Response(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch {
    return jsonResponse(502, {
      code: 'network_error',
      error: 'Gagal menghubungi server ElevenLabs. Periksa koneksi internet Anda.',
    });
  }
}

/**
 * Cloudflare Worker entry handler for `/api/*` TTS routes and static asset fallback.
 */
export async function handleWorkerFetch(
  request: Request,
  env: WorkerEnv,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/tts/status') {
    return handleTtsStatus(request, env);
  }

  if (url.pathname === '/api/tts/elevenlabs') {
    return handleElevenLabsTts(request, url, env, fetchImpl);
  }

  if (url.pathname.startsWith('/api/')) {
    return jsonResponse(404, { error: 'Not found' });
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch(request: Request, env: WorkerEnv) {
    return handleWorkerFetch(request, env);
  },
};
