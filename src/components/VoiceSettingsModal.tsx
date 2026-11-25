import { useEffect, useRef, useState } from 'react';
import {
  X,
  Volume2,
  Eye,
  EyeOff,
  CheckCircle2,
  Trash2,
  Loader2,
  ShieldCheck,
  Radio,
  ChevronDown,
  AudioLines,
} from 'lucide-react';
import type {
  ElevenLabsModelId,
  ElevenLabsSettings,
  SpeechAccent,
  SpeechRate,
  TtsProvider,
} from '../types';
import {
  ELEVENLABS_MODELS,
  ELEVENLABS_VOICES,
  loadElevenLabsApiKey,
  saveElevenLabsApiKey,
  type ServerTtsStatus,
} from '../speech/elevenlabs';
import { clearAudioCache, getCachedAudioCount } from '../speech/audioCache';
import { speakEnglish, stopSpeaking } from '../speech/tts';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  speechRate: SpeechRate;
  serverStatus: ServerTtsStatus;
  onClose: () => void;
  onChangeProvider: (provider: TtsProvider) => void;
  onChangeElevenLabs: (next: ElevenLabsSettings) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

const UK_VOICES = ELEVENLABS_VOICES.filter((v) => v.accent === 'en-GB');
const US_VOICES = ELEVENLABS_VOICES.filter((v) => v.accent === 'en-US');

const SAMPLE_SENTENCES: Record<SpeechAccent, string> = {
  'en-GB': 'A quiet ten-minute morning session makes all the difference to your fluency.',
  'en-US': 'Hearing phrases in natural context helps you recall them effortlessly.',
};

export function VoiceSettingsModal({
  isOpen,
  ttsProvider,
  elevenLabs,
  speechRate,
  serverStatus,
  onClose,
  onChangeProvider,
  onChangeElevenLabs,
  onNotify,
}: VoiceSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasStoredLocalKey, setHasStoredLocalKey] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [testingAccent, setTestingAccent] = useState<SpeechAccent | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }
      if (!dialog.open) {
        dialog.showModal();
      }
      const saved = loadElevenLabsApiKey();
      setApiKeyInput(saved);
      setHasStoredLocalKey(saved.length > 0);
      setLastTestResult(null);
      void getCachedAudioCount().then(setCachedCount);
    } else {
      if (dialog.open) {
        dialog.close();
      }
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      prev?.focus();
    }
  }, [isOpen]);

  const isReadyForElevenLabs =
    serverStatus.serverConfigured || hasStoredLocalKey || Boolean(elevenLabs.customProxyUrl);

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    saveElevenLabsApiKey(trimmed);
    setHasStoredLocalKey(trimmed.length > 0);
    if (trimmed) {
      onChangeProvider('elevenlabs');
      onNotify('success', 'API key ElevenLabs tersimpan lokal di browser ini.');
    } else {
      onNotify('info', 'API key lokal dihapus.');
    }
  };

  const handleClearApiKey = () => {
    setApiKeyInput('');
    saveElevenLabsApiKey('');
    setHasStoredLocalKey(false);
    onNotify('info', 'API key lokal dihapus dari browser.');
  };

  const handleTestVoice = async (accent: SpeechAccent) => {
    setTestingAccent(accent);
    setLastTestResult(null);
    const activeKey = apiKeyInput.trim();
    if (activeKey && !hasStoredLocalKey) {
      saveElevenLabsApiKey(activeKey);
      setHasStoredLocalKey(true);
    }

    await speakEnglish({
      text: SAMPLE_SENTENCES[accent],
      accent,
      rate: speechRate,
      provider: ttsProvider,
      elevenLabs,
      apiKey: activeKey,
      onLoading: (loading) => setLoadingAudio(loading),
      onStart: (usedProvider) => {
        setLastTestResult(
          usedProvider === 'elevenlabs'
            ? `Diputar dengan suara studio ElevenLabs (${accent === 'en-GB' ? 'UK' : 'US'}).`
            : `Diputar dengan suara browser (${accent === 'en-GB' ? 'UK' : 'US'}).`
        );
      },
      onFallback: (reason) => {
        setLastTestResult(reason);
      },
      onEnd: () => {
        setTestingAccent(null);
        setLoadingAudio(false);
        void getCachedAudioCount().then(setCachedCount);
      },
      onError: () => {
        setTestingAccent(null);
        setLoadingAudio(false);
      },
    });
  };

  const handleClearCache = async () => {
    await clearAudioCache();
    setCachedCount(0);
    onNotify('info', 'Cache audio lokal dibersihkan.');
  };

  return (
    <dialog
      ref={dialogRef}
      className="pagikata-dialog"
      aria-labelledby="voice-settings-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      {isOpen && (
        <div
          className="paper-card-elevated w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[24px] p-5 sm:p-6 space-y-5 animate-card-reveal"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="voice-settings-title" className="font-serif-study text-2xl font-medium leading-tight">
              Pengaturan Suara & ElevenLabs
            </h2>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Tutup pengaturan suara"
              className="flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center rounded-xl p-2 transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <fieldset className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 border-0 p-0 m-0">
            <legend className="sr-only">Pilih mesin suara</legend>

            <div className="relative">
              <input
                type="radio"
                id="tts-provider-browser"
                name="tts-provider"
                value="browser"
                checked={ttsProvider === 'browser'}
                onChange={() => onChangeProvider('browser')}
                className="sr-only peer"
              />
              <label
                htmlFor="tts-provider-browser"
                className="block h-full cursor-pointer rounded-xl p-3.5 text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                style={{
                  backgroundColor: ttsProvider === 'browser' ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  border:
                    ttsProvider === 'browser'
                      ? '1.5px solid var(--accent-solid)'
                      : '1.5px solid transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Browser Standar</span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                  >
                    Gratis
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Web Speech API bawaan perangkat: cepat, gratis, dan bisa dipakai offline.
                </p>
              </label>
            </div>

            <div className="relative">
              <input
                type="radio"
                id="tts-provider-elevenlabs"
                name="tts-provider"
                value="elevenlabs"
                checked={ttsProvider === 'elevenlabs'}
                onChange={() => onChangeProvider('elevenlabs')}
                className="sr-only peer"
              />
              <label
                htmlFor="tts-provider-elevenlabs"
                className="block h-full cursor-pointer rounded-xl p-3.5 text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                style={{
                  backgroundColor:
                    ttsProvider === 'elevenlabs' ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  border:
                    ttsProvider === 'elevenlabs'
                      ? '1.5px solid var(--accent-solid)'
                      : '1.5px solid transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <AudioLines className="h-3.5 w-3.5" style={{ color: 'var(--accent-text)' }} aria-hidden="true" />
                    ElevenLabs
                  </span>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--text-on-accent)' }}
                  >
                    Natural
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Suara aksen Inggris & Amerika sangat natural bergaya penyiar BBC, lengkap dengan cache lokal.
                </p>
              </label>
            </div>
          </fieldset>

          {ttsProvider === 'elevenlabs' && (
            <div className="space-y-4 pt-1 animate-card-reveal">
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent-text)' }} aria-hidden="true" />
                    <span>Koneksi ElevenLabs</span>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: isReadyForElevenLabs
                        ? 'var(--accent-soft)'
                        : 'var(--rate-hard-bg)',
                      color: isReadyForElevenLabs
                        ? 'var(--accent-text)'
                        : 'var(--rate-hard-text)',
                    }}
                  >
                    {serverStatus.serverConfigured ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Aktif via .env
                      </>
                    ) : hasStoredLocalKey ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Kunci Lokal Siap
                      </>
                    ) : (
                      'Perlu API Key'
                    )}
                  </span>
                </div>

                {serverStatus.serverConfigured ? (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Server lokal mendeteksi <code className="font-mono-code">ELEVENLABS_API_KEY</code> di{' '}
                    <code className="font-mono-code">.env.local</code>. Audio diproses aman melalui proxy tanpa mengekspos kunci ke browser.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    <label
                      htmlFor="elevenlabs-api-key"
                      className="block text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Masukkan API Key ElevenLabs Anda, atau isi{' '}
                      <code className="font-mono-code">ELEVENLABS_API_KEY</code> di file{' '}
                      <code className="font-mono-code">.env.local</code>:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="elevenlabs-api-key"
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="sk_..."
                          autoComplete="off"
                          className="w-full min-h-11 sm:min-h-9 rounded-xl py-2 pl-3 pr-11 sm:pr-9 font-mono-code text-base sm:text-xs"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-strong)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((v) => !v)}
                          aria-label={showApiKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 flex min-h-10 min-w-10 sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg p-1"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {showApiKey ? (
                            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveApiKey}
                        className="min-h-11 sm:min-h-9 rounded-xl px-3.5 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                        style={{
                          backgroundColor: 'var(--accent-solid)',
                          color: 'var(--text-on-accent)',
                        }}
                      >
                        Simpan
                      </button>
                      {hasStoredLocalKey && (
                        <button
                          type="button"
                          onClick={handleClearApiKey}
                          aria-label="Hapus API key"
                          className="flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--rate-again-text)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Privasi terjaga: kunci disimpan terpisah di perangkat ini saja dan tidak pernah ikut di file Export Backup JSON. Jika offline atau kuota habis, audio otomatis fallback ke suara browser.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="el-uk-voice"
                    className="block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Suara British (UK • Default)
                  </label>
                  <select
                    id="el-uk-voice"
                    value={elevenLabs.ukVoiceId}
                    onChange={(e) =>
                      onChangeElevenLabs({ ...elevenLabs, ukVoiceId: e.target.value })
                    }
                    className="w-full min-h-11 sm:min-h-9 rounded-xl px-3 py-2.5 text-base sm:text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {UK_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.styleLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="el-us-voice"
                    className="block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Suara American (US)
                  </label>
                  <select
                    id="el-us-voice"
                    value={elevenLabs.usVoiceId}
                    onChange={(e) =>
                      onChangeElevenLabs({ ...elevenLabs, usVoiceId: e.target.value })
                    }
                    className="w-full min-h-11 sm:min-h-9 rounded-xl px-3 py-2.5 text-base sm:text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {US_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.styleLabel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Model Suara ElevenLabs
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ELEVENLABS_MODELS.map((model) => {
                    const selected = elevenLabs.modelId === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          onChangeElevenLabs({
                            ...elevenLabs,
                            modelId: model.id as ElevenLabsModelId,
                          })
                        }
                        className="min-h-11 rounded-xl p-3 text-left transition-colors"
                        style={{
                          backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          border: selected
                            ? '1.5px solid var(--accent-solid)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <div className="text-xs font-bold">{model.label}</div>
                        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                          {model.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <details className="rounded-xl px-3.5 py-2.5" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <summary className="flex min-h-11 sm:min-h-9 cursor-pointer list-none items-center justify-between text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <span>Opsi Lanjutan (Custom Proxy Endpoint)</span>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </summary>
                <div className="mt-2.5 space-y-1.5">
                  <label
                    htmlFor="el-custom-proxy"
                    className="block text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Kosongkan untuk memakai proxy bawaan (<code className="font-mono-code">/api/tts/elevenlabs</code>). Isi jika Anda men-deploy proxy sendiri (mis. Cloudflare Worker / Vercel).
                  </label>
                  <input
                    id="el-custom-proxy"
                    type="url"
                    value={elevenLabs.customProxyUrl}
                    onChange={(e) =>
                      onChangeElevenLabs({ ...elevenLabs, customProxyUrl: e.target.value })
                    }
                    placeholder="https://proxy-anda.workers.dev/api/tts/elevenlabs"
                    className="w-full min-h-11 sm:min-h-9 rounded-xl px-3 py-2 font-mono-code text-base sm:text-xs"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </details>
            </div>
          )}

          <div
            className="space-y-3 pt-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loadingAudio}
                onClick={() => void handleTestVoice('en-GB')}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-opacity disabled:opacity-60 hover:opacity-95"
                style={{
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--text-on-accent)',
                }}
              >
                {loadingAudio && testingAccent === 'en-GB' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Tes Suara UK</span>
              </button>

              <button
                type="button"
                disabled={loadingAudio}
                onClick={() => void handleTestVoice('en-US')}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 hover:bg-[var(--bg-hover)]"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {loadingAudio && testingAccent === 'en-US' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Tes Suara US</span>
              </button>
            </div>

            {lastTestResult && (
              <p
                className="rounded-xl px-3 py-2 text-xs text-pretty"
                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
              >
                {lastTestResult}
              </p>
            )}

            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="tabular-nums">
                Cache audio lokal: <strong style={{ color: 'var(--text-primary)' }}>{cachedCount}</strong> klip tersimpan (hemat kuota)
              </span>
              {cachedCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearCache()}
                  className="min-h-11 sm:min-h-8 px-2 -mr-2 rounded-lg font-semibold hover:underline"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Hapus Cache
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
