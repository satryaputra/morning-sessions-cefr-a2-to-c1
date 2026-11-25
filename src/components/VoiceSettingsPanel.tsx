import { useEffect, useState } from 'react';
import {
  Volume2,
  Loader2,
  ChevronDown,
  AudioLines,
  Check,
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
  isElevenLabsConfigured,
  loadElevenLabsApiKey,
  type ServerTtsStatus,
} from '../speech/elevenlabs';
import { clearAudioCache, getCachedAudioCount } from '../speech/audioCache';
import { speakEnglish } from '../speech/tts';

export interface VoiceSettingsPanelProps {
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  serverStatus: ServerTtsStatus;
  onChangeAccent: (accent: SpeechAccent) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onChangeProvider: (provider: TtsProvider) => void;
  onChangeElevenLabs: (next: ElevenLabsSettings) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
  idPrefix?: string;
}

const US_VOICES = ELEVENLABS_VOICES.filter((v) => v.accent === 'en-US');
const UK_VOICES = ELEVENLABS_VOICES.filter((v) => v.accent === 'en-GB');

const ACCENT_OPTIONS: Array<{ value: SpeechAccent; label: string; short: string }> = [
  { value: 'en-US', label: 'American (US)', short: 'en-US' },
  { value: 'en-GB', label: 'British (UK)', short: 'en-GB' },
];

const RATE_OPTIONS: Array<{ value: SpeechRate; label: string }> = [
  { value: 1.0, label: '1.0x Normal' },
  { value: 0.8, label: '0.8x Lambat' },
];

const SAMPLE_SENTENCES: Record<SpeechAccent, string> = {
  'en-US': 'Hearing phrases in natural context helps you recall them effortlessly.',
  'en-GB': 'A quiet ten-minute daily session makes all the difference to your fluency.',
};

export function VoiceSettingsPanel({
  accent,
  speechRate,
  ttsProvider,
  elevenLabs,
  serverStatus,
  onChangeAccent,
  onChangeSpeechRate,
  onChangeProvider,
  onChangeElevenLabs,
  onNotify,
  idPrefix = 'voice',
}: VoiceSettingsPanelProps) {
  const [hasStoredLocalKey, setHasStoredLocalKey] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [testingAccent, setTestingAccent] = useState<SpeechAccent | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadElevenLabsApiKey();
    setHasStoredLocalKey(saved.length > 0);
    void getCachedAudioCount().then(setCachedCount);
  }, []);

  const elevenLabsReady = isElevenLabsConfigured(serverStatus, elevenLabs, hasStoredLocalKey) ||
    (!serverStatus.available && (ttsProvider === 'elevenlabs' || cachedCount > 0));
  const effectiveProvider: TtsProvider =
    ttsProvider === 'elevenlabs' && elevenLabsReady ? 'elevenlabs' : 'browser';

  const handleTestVoice = async (targetAccent: SpeechAccent) => {
    setTestingAccent(targetAccent);
    setLastTestResult(null);

    await speakEnglish({
      text: SAMPLE_SENTENCES[targetAccent],
      accent: targetAccent,
      rate: speechRate,
      provider: effectiveProvider,
      elevenLabs,
      onLoading: (loading) => setLoadingAudio(loading),
      onStart: (usedProvider) => {
        setLastTestResult(
          usedProvider === 'elevenlabs'
            ? `Diputar dengan suara studio ElevenLabs (${targetAccent === 'en-US' ? 'US' : 'UK'}).`
            : `Diputar dengan suara browser (${targetAccent === 'en-US' ? 'US' : 'UK'}).`
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
    <div className="flex flex-col gap-6 min-w-0 max-w-full" data-voice-panel={idPrefix}>
      <fieldset className="m-0 min-w-0 max-w-full border-0 p-0" data-voice-group="accent">
        <legend
          className="mb-2 block w-full p-0 text-xs font-semibold leading-5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Aksen Pelafalan
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0" data-voice-control="accent">
          {ACCENT_OPTIONS.map((option) => {
            const selected = accent === option.value;
            const inputId = `${idPrefix}-accent-${option.value}`;
            return (
              <div key={option.value} className="relative min-w-0">
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-accent`}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChangeAccent(option.value)}
                  className="sr-only peer"
                />
                <label
                  htmlFor={inputId}
                  className="flex min-h-11 min-w-0 max-w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-[clamp(12px,3vw,1rem)] py-3 text-xs font-semibold break-words transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                  style={{
                    backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: selected
                      ? '1.5px solid var(--accent-solid)'
                      : '1.5px solid transparent',
                  }}
                >
                  <span className="min-w-0 break-words">{option.label}</span>
                  {selected && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--accent-text)' }}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 min-w-0 max-w-full border-0 p-0" data-voice-group="rate">
        <legend
          className="mb-2 block w-full p-0 text-xs font-semibold leading-5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Kecepatan Audio
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0" data-voice-control="rate">
          {RATE_OPTIONS.map((option) => {
            const selected = speechRate === option.value;
            const inputId = `${idPrefix}-rate-${option.value}`;
            return (
              <div key={option.value} className="relative min-w-0">
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-rate`}
                  value={String(option.value)}
                  checked={selected}
                  onChange={() => onChangeSpeechRate(option.value)}
                  className="sr-only peer"
                />
                <label
                  htmlFor={inputId}
                  className="flex min-h-11 min-w-0 max-w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-[clamp(12px,3vw,1rem)] py-3 text-xs font-semibold tabular-nums break-words transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                  style={{
                    backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: selected
                      ? '1.5px solid var(--accent-solid)'
                      : '1.5px solid transparent',
                  }}
                >
                  <span className="min-w-0 break-words">{option.label}</span>
                  {selected && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: 'var(--accent-text)' }}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 min-w-0 max-w-full border-0 p-0" data-voice-group="provider">
        <legend
          className="mb-2 block w-full p-0 text-xs font-semibold leading-5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Mesin Suara
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0" data-voice-control="provider">
          <div className="relative min-w-0">
            <input
              type="radio"
              id={`${idPrefix}-provider-browser`}
              name={`${idPrefix}-provider`}
              value="browser"
              checked={effectiveProvider === 'browser'}
              onChange={() => onChangeProvider('browser')}
              className="sr-only peer"
            />
            <label
              htmlFor={`${idPrefix}-provider-browser`}
              className="block h-full max-w-full min-w-0 break-words cursor-pointer rounded-xl p-[clamp(12px,3vw,1rem)] text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
              style={{
                backgroundColor:
                  effectiveProvider === 'browser' ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                border:
                  effectiveProvider === 'browser'
                    ? '1.5px solid var(--accent-solid)'
                    : '1.5px solid transparent',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 break-words text-sm font-bold">Browser Standar</span>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                >
                  Gratis
                </span>
              </div>
              <p className="mt-1.5 min-w-0 break-words text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Web Speech API bawaan perangkat: cepat, gratis, dan bisa dipakai offline.
              </p>
            </label>
          </div>

          <div className="relative min-w-0">
            <input
              type="radio"
              id={`${idPrefix}-provider-elevenlabs`}
              name={`${idPrefix}-provider`}
              value="elevenlabs"
              disabled={!elevenLabsReady}
              checked={effectiveProvider === 'elevenlabs'}
              onChange={() => {
                if (elevenLabsReady) onChangeProvider('elevenlabs');
              }}
              className="sr-only peer"
            />
            <label
              htmlFor={`${idPrefix}-provider-elevenlabs`}
              data-disabled={!elevenLabsReady ? 'true' : undefined}
              aria-disabled={!elevenLabsReady ? 'true' : undefined}
              className={`block h-full max-w-full min-w-0 break-words rounded-xl p-[clamp(12px,3vw,1rem)] text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)] ${
                elevenLabsReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              }`}
              style={{
                backgroundColor:
                  effectiveProvider === 'elevenlabs' ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                border:
                  effectiveProvider === 'elevenlabs'
                    ? '1.5px solid var(--accent-solid)'
                    : !elevenLabsReady
                      ? '1.5px solid var(--border-subtle)'
                      : '1.5px solid transparent',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-bold">
                  <AudioLines
                    className="h-3.5 w-3.5 shrink-0"
                    style={{
                      color: elevenLabsReady ? 'var(--accent-text)' : 'var(--text-muted)',
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">ElevenLabs</span>
                </span>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={
                    elevenLabsReady
                      ? {
                          backgroundColor: 'var(--accent-solid)',
                          color: 'var(--text-on-accent)',
                        }
                      : {
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                        }
                  }
                >
                  {elevenLabsReady ? 'Natural' : 'Tidak aktif'}
                </span>
              </div>
              <p className="mt-1.5 min-w-0 break-words text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {elevenLabsReady
                  ? 'Suara aksen Amerika dan Inggris yang natural, lengkap dengan cache audio lokal.'
                  : 'Belum terkonfigurasi. Atur ELEVENLABS_API_KEY di server untuk mengaktifkan.'}
              </p>
            </label>
          </div>
        </div>
      </fieldset>

      {effectiveProvider === 'elevenlabs' && (
        <div className="flex flex-col gap-6 min-w-0 max-w-full animate-card-reveal" data-voice-elevenlabs>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
            <div className="flex flex-col gap-2 min-w-0" data-voice-group="us-voice">
              <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 min-w-0" data-voice-label="us-voice">
                <label
                  htmlFor={`${idPrefix}-us-voice`}
                  className="min-w-0 break-words text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Suara American (US)
                </label>
                {accent === 'en-US' && (
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    Aktif
                  </span>
                )}
              </div>
              <select
                id={`${idPrefix}-us-voice`}
                value={elevenLabs.usVoiceId}
                onChange={(e) =>
                  onChangeElevenLabs({ ...elevenLabs, usVoiceId: e.target.value })
                }
                data-voice-control="us-voice"
                className="w-full max-w-full min-w-0 min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-xs font-medium"
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

            <div className="flex flex-col gap-2 min-w-0" data-voice-group="uk-voice">
              <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 min-w-0" data-voice-label="uk-voice">
                <label
                  htmlFor={`${idPrefix}-uk-voice`}
                  className="min-w-0 break-words text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Suara British (UK)
                </label>
                {accent === 'en-GB' && (
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    Aktif
                  </span>
                )}
              </div>
              <select
                id={`${idPrefix}-uk-voice`}
                value={elevenLabs.ukVoiceId}
                onChange={(e) =>
                  onChangeElevenLabs({ ...elevenLabs, ukVoiceId: e.target.value })
                }
                data-voice-control="uk-voice"
                className="w-full max-w-full min-w-0 min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-xs font-medium"
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
          </div>

          <fieldset className="m-0 min-w-0 max-w-full border-0 p-0" data-voice-group="model">
            <legend
              className="mb-2 block w-full p-0 text-xs font-semibold leading-5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Model Suara ElevenLabs
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0" data-voice-control="model">
              {ELEVENLABS_MODELS.map((model) => {
                const selected = elevenLabs.modelId === model.id;
                const inputId = `${idPrefix}-model-${model.id}`;
                return (
                  <div key={model.id} className="relative min-w-0">
                    <input
                      id={inputId}
                      type="radio"
                      name={`${idPrefix}-model`}
                      value={model.id}
                      checked={selected}
                      onChange={() =>
                        onChangeElevenLabs({
                          ...elevenLabs,
                          modelId: model.id as ElevenLabsModelId,
                        })
                      }
                      className="sr-only peer"
                    />
                    <label
                      htmlFor={inputId}
                      className="block h-full max-w-full min-w-0 break-words cursor-pointer rounded-xl p-[clamp(12px,3vw,1rem)] text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                      style={{
                        backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                        border: selected
                          ? '1.5px solid var(--accent-solid)'
                          : '1.5px solid transparent',
                      }}
                    >
                      <div className="min-w-0 break-words text-xs font-bold">{model.label}</div>
                      <p className="mt-1 min-w-0 break-words text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {model.desc}
                      </p>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <details className="min-w-0 max-w-full rounded-xl p-[clamp(12px,3vw,1rem)]" style={{ backgroundColor: 'var(--bg-subtle)' }} data-voice-group="proxy">
            <summary
              className="flex min-h-11 sm:min-h-9 min-w-0 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="min-w-0 break-words">Opsi Lanjutan (Custom Proxy Endpoint)</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </summary>
            <div className="mt-3 flex flex-col gap-2 min-w-0">
              <label
                htmlFor={`${idPrefix}-custom-proxy`}
                className="block min-w-0 break-words text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                Kosongkan untuk memakai proxy bawaan (<code className="font-mono-code break-all">/api/tts/elevenlabs</code>). Isi jika Anda men-deploy proxy sendiri.
              </label>
              <input
                id={`${idPrefix}-custom-proxy`}
                type="url"
                value={elevenLabs.customProxyUrl}
                onChange={(e) =>
                  onChangeElevenLabs({ ...elevenLabs, customProxyUrl: e.target.value })
                }
                placeholder="https://proxy-anda.workers.dev/api/tts/elevenlabs"
                className="w-full max-w-full min-w-0 min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 font-mono-code text-base sm:text-xs"
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
        className="flex flex-col gap-3 pt-6 min-w-0 max-w-full"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
        data-voice-group="actions"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
          <button
            type="button"
            disabled={loadingAudio}
            onClick={() => void handleTestVoice('en-US')}
            className="inline-flex min-h-11 w-full max-w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-xl px-[clamp(12px,3vw,1rem)] py-3 text-xs font-semibold break-words transition-colors disabled:opacity-60 hover:bg-[var(--bg-hover)]"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            {loadingAudio && testingAccent === 'en-US' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">Tes Suara US</span>
          </button>

          <button
            type="button"
            disabled={loadingAudio}
            onClick={() => void handleTestVoice('en-GB')}
            className="inline-flex min-h-11 w-full max-w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-xl px-[clamp(12px,3vw,1rem)] py-3 text-xs font-semibold break-words transition-colors disabled:opacity-60 hover:bg-[var(--bg-hover)]"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            {loadingAudio && testingAccent === 'en-GB' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">Tes Suara UK</span>
          </button>
        </div>

        {lastTestResult && (
          <p
            className="min-w-0 max-w-full break-words rounded-xl p-[clamp(12px,3vw,1rem)] text-xs text-pretty"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
          >
            {lastTestResult}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="min-w-0 break-words tabular-nums">
            Cache audio lokal: <strong style={{ color: 'var(--text-primary)' }}>{cachedCount}</strong> klip tersimpan
          </span>
          {cachedCount > 0 && (
            <button
              type="button"
              onClick={() => void handleClearCache()}
              className="min-h-11 sm:min-h-8 shrink-0 max-w-full px-2 rounded-lg font-semibold hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              Hapus Cache
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
