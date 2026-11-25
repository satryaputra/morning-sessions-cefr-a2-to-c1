import type {
  ElevenLabsSettings,
  LearningPhaseId,
  SpeechAccent,
  SpeechRate,
  TtsProvider,
} from '../types';
import type { ServerTtsStatus } from '../speech/elevenlabs';
import { LEARNING_PHASES } from '../data';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

interface SettingsViewProps {
  phaseId: LearningPhaseId;
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  serverStatus: ServerTtsStatus;
  onChangePhase: (phaseId: LearningPhaseId) => void;
  onChangeAccent: (accent: SpeechAccent) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onChangeProvider: (provider: TtsProvider) => void;
  onChangeElevenLabs: (next: ElevenLabsSettings) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

export function SettingsView({
  phaseId,
  accent,
  speechRate,
  ttsProvider,
  elevenLabs,
  serverStatus,
  onChangePhase,
  onChangeAccent,
  onChangeSpeechRate,
  onChangeProvider,
  onChangeElevenLabs,
  onNotify,
}: SettingsViewProps) {
  return (
    <div className="space-y-6 pb-8 animate-card-reveal">
      <section>
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em]">
          Setelan
        </h1>
        <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
          Atur mode belajar, aksen pelafalan, dan mesin suara untuk sesi review harian.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Mode Belajar</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Pilih mode tingkat kesulitan. Deck rekomendasi dan petunjuk bahasa Indonesia otomatis menyesuaikan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LEARNING_PHASES.map((phase) => {
            const isSelected = phase.id === phaseId;
            return (
              <button
                key={phase.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChangePhase(phase.id)}
                className="group relative rounded-2xl p-4 text-left transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  border: isSelected
                    ? '1.5px solid var(--accent-solid)'
                    : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? 'none' : 'var(--shadow-card)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-solid)' : 'var(--bg-subtle)',
                      color: isSelected ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {phase.cefrTarget}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-muted)' }}
                  >
                    {phase.monthsLabel}
                  </span>
                </div>
                <div className="mt-2.5 text-sm font-semibold">{phase.title}</div>
                <p
                  className="mt-1 text-xs leading-relaxed text-pretty"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {phase.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="paper-card rounded-[24px] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold">Aksen & Suara</h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Pilih aksen utama yang ingin dilatih dan atur mesin suara pelafalan.
          </p>
        </div>

        <VoiceSettingsPanel
          idPrefix="settings-voice"
          accent={accent}
          speechRate={speechRate}
          ttsProvider={ttsProvider}
          elevenLabs={elevenLabs}
          serverStatus={serverStatus}
          onChangeAccent={onChangeAccent}
          onChangeSpeechRate={onChangeSpeechRate}
          onChangeProvider={onChangeProvider}
          onChangeElevenLabs={onChangeElevenLabs}
          onNotify={onNotify}
        />
      </section>
    </div>
  );
}
