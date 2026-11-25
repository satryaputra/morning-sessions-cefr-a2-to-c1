import { useRef } from 'react';
import {
  SlidersHorizontal,
  Volume2,
  Layers,
  PlusCircle,
  Sun,
  Moon,
  Monitor,
  Check,
} from 'lucide-react';
import type {
  DailyNewPreset,
  DeckDefinition,
  ElevenLabsSettings,
  LearningPhaseId,
  SettingsSectionId,
  SpeechAccent,
  SpeechRate,
  StoredFsrsCard,
  ThemePreference,
  TtsProvider,
  VocabCard,
} from '../types';
import type { ServerTtsStatus } from '../speech/elevenlabs';
import { LEARNING_PHASES } from '../data';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { DecksView } from './DecksView';
import { AddImportView } from './AddImportView';

interface SettingsViewProps {
  activeSection: SettingsSectionId;
  onSelectSection: (section: SettingsSectionId) => void;
  phaseId: LearningPhaseId;
  dailyNewLimit: DailyNewPreset;
  theme: ThemePreference;
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  serverStatus: ServerTtsStatus;
  decks: DeckDefinition[];
  allCards: VocabCard[];
  progress: Record<string, StoredFsrsCard>;
  activeDeckIds: string[];
  onChangePhase: (phaseId: LearningPhaseId) => void;
  onChangeDailyNewLimit: (limit: DailyNewPreset) => void;
  onChangeTheme: (theme: ThemePreference) => void;
  onChangeAccent: (accent: SpeechAccent) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onChangeProvider: (provider: TtsProvider) => void;
  onChangeElevenLabs: (next: ElevenLabsSettings) => void;
  onToggleDeck: (deckId: string) => void;
  onImportCards: (cards: VocabCard[], newDeckTitle?: string) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

const SECTION_ORDER: SettingsSectionId[] = ['learning', 'voice', 'decks', 'import'];

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: SettingsSectionId; label: string; icon: typeof SlidersHorizontal }>;
}> = [
  {
    title: 'Preferensi',
    items: [
      { id: 'learning', label: 'Belajar & Tampilan', icon: SlidersHorizontal },
      { id: 'voice', label: 'Aksen & Suara', icon: Volume2 },
    ],
  },
  {
    title: 'Koleksi Kata',
    items: [
      { id: 'decks', label: 'Deck Kosakata', icon: Layers },
      { id: 'import', label: 'Tambah & Import', icon: PlusCircle },
    ],
  },
];

const DAILY_LIMIT_PRESETS: Array<{
  value: DailyNewPreset;
  label: string;
  perDay: string;
  duration: string;
}> = [
  { value: 5, label: 'Ringan', perDay: '5 kata baru/hari', duration: 'Estimasi 5–7 menit' },
  { value: 10, label: 'Standar', perDay: '10 kata baru/hari', duration: 'Estimasi 10–12 menit' },
  { value: 15, label: 'Intensif', perDay: '15 kata baru/hari', duration: 'Estimasi 15 menit' },
];

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  desc: string;
  icon: typeof Sun;
}> = [
  {
    value: 'light',
    label: 'Terang',
    desc: 'Kertas hangat untuk membaca dengan terang.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Gelap',
    desc: 'Latar arang lembut yang nyaman di malam hari.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Ikuti Sistem',
    desc: 'Menyesuaikan mode perangkat secara otomatis.',
    icon: Monitor,
  },
];

export function SettingsView({
  activeSection,
  onSelectSection,
  phaseId,
  dailyNewLimit,
  theme,
  accent,
  speechRate,
  ttsProvider,
  elevenLabs,
  serverStatus,
  decks,
  allCards,
  progress,
  activeDeckIds,
  onChangePhase,
  onChangeDailyNewLimit,
  onChangeTheme,
  onChangeAccent,
  onChangeSpeechRate,
  onChangeProvider,
  onChangeElevenLabs,
  onToggleDeck,
  onImportCards,
  onNotify,
}: SettingsViewProps) {
  const tabRefs = useRef<Partial<Record<SettingsSectionId, HTMLButtonElement | null>>>({});

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentId: SettingsSectionId) => {
    const idx = SECTION_ORDER.indexOf(currentId);
    let nextId: SettingsSectionId | null = null;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextId = SECTION_ORDER[(idx + 1) % SECTION_ORDER.length];
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextId = SECTION_ORDER[(idx - 1 + SECTION_ORDER.length) % SECTION_ORDER.length];
    } else if (e.key === 'Home') {
      nextId = SECTION_ORDER[0];
    } else if (e.key === 'End') {
      nextId = SECTION_ORDER[SECTION_ORDER.length - 1];
    }

    if (nextId) {
      e.preventDefault();
      onSelectSection(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8 animate-card-reveal">
      <section>
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em]">
          Setelan
        </h1>
        <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
          Kelola preferensi belajar, suara pelafalan, dan koleksi kosakata Anda dalam satu tempat.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="lg:sticky lg:top-24">
          <div
            role="tablist"
            aria-label="Kategori setelan"
            className="flex flex-col gap-4 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 sm:grid sm:grid-cols-2 sm:gap-4 lg:flex lg:flex-col lg:gap-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-1.5">
                <p
                  className="px-1 lg:px-3 text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.title}
                </p>
                <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          tabRefs.current[item.id] = el;
                        }}
                        id={`settings-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`settings-panel-${item.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onSelectSection(item.id)}
                        onKeyDown={(e) => handleTabKeyDown(e, item.id)}
                        className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                          isActive
                            ? 'font-semibold'
                            : 'font-medium hover:bg-[var(--bg-subtle)]'
                        }`}
                        style={{
                          backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                          color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                          boxShadow: isActive ? 'inset 0 0 0 1px var(--accent-border)' : 'none',
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={isActive ? 2.1 : 1.75}
                            aria-hidden="true"
                          />
                          <span className="leading-snug lg:truncate">{item.label}</span>
                        </span>
                        {item.id === 'decks' && (
                          <span
                            className="hidden lg:inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none"
                            style={{
                              backgroundColor: isActive ? 'var(--bg-surface)' : 'var(--bg-subtle)',
                              color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                            }}
                          >
                            {activeDeckIds.length}/{decks.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div
          id={`settings-panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeSection}`}
          className="min-w-0"
        >
          {activeSection === 'learning' && (
            <div className="flex flex-col gap-6 animate-card-reveal">
              <section className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-bold">Mode Belajar</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
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
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          border: isSelected
                            ? '1.5px solid var(--accent-solid)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: isSelected ? 'var(--accent-solid)' : 'var(--bg-surface)',
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

              <section className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-bold">Jatah Kartu Baru Harian</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
                    Pilih ritme nyaman setiap pagi. Antrean review lama tetap otomatis dijaga agar tidak menumpuk.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {DAILY_LIMIT_PRESETS.map((preset) => {
                    const isSelected = dailyNewLimit === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => onChangeDailyNewLimit(preset.value)}
                        aria-pressed={isSelected}
                        className="flex min-h-11 items-start justify-between gap-2 rounded-xl p-4 text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          border: isSelected
                            ? '1.5px solid var(--accent-solid)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-bold">{preset.label}</span>
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: 'var(--accent-text)' }}
                            >
                              {preset.value}
                            </span>
                          </div>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {preset.perDay}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {preset.duration}
                          </span>
                        </div>
                        {isSelected && (
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: 'var(--accent-solid)',
                              color: 'var(--text-on-accent)',
                            }}
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-bold">Tampilan</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
                    Atur warna tampilan aplikasi agar nyaman dibaca kapan saja.
                  </p>
                </div>

                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="sr-only">Pilih tema tampilan</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {THEME_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = theme === opt.value;
                      const inputId = `settings-theme-${opt.value}`;
                      return (
                        <div key={opt.value} className="relative">
                          <input
                            id={inputId}
                            type="radio"
                            name="settings-theme"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => onChangeTheme(opt.value)}
                            className="sr-only peer"
                          />
                          <label
                            htmlFor={inputId}
                            className="flex h-full min-h-11 cursor-pointer flex-col justify-between gap-2 rounded-xl p-4 text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                            style={{
                              backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                              border: isSelected
                                ? '1.5px solid var(--accent-solid)'
                                : '1.5px solid transparent',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="inline-flex items-center gap-2 text-sm font-bold"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Icon
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)' }}
                                  aria-hidden="true"
                                />
                                <span>{opt.label}</span>
                              </span>
                              {isSelected && (
                                <Check
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: 'var(--accent-text)' }}
                                  strokeWidth={2.5}
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {opt.desc}
                            </p>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              </section>
            </div>
          )}

          {activeSection === 'voice' && (
            <section className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-6 animate-card-reveal">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-bold">Aksen & Suara</h2>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
          )}

          {activeSection === 'decks' && (
            <DecksView
              embedded
              decks={decks}
              allCards={allCards}
              progress={progress}
              activeDeckIds={activeDeckIds}
              phaseId={phaseId}
              accent={accent}
              speechRate={speechRate}
              ttsProvider={ttsProvider}
              elevenLabs={elevenLabs}
              onToggleDeck={onToggleDeck}
            />
          )}

          {activeSection === 'import' && (
            <AddImportView
              embedded
              decks={decks}
              onImportCards={onImportCards}
              onNotify={onNotify}
            />
          )}
        </div>
      </div>
    </div>
  );
}
