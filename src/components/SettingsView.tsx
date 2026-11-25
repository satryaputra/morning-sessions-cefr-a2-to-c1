import { useRef, useState } from 'react';
import {
  SlidersHorizontal,
  Volume2,
  Layers,
  PlusCircle,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Check,
} from 'lucide-react';
import type {
  AppState,
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
import {
  parseBackup,
  serializeBackup,
  triggerJsonDownload,
  type ParsedBackupResult,
} from '../importExport/backup';
import { getLocalDateKey } from '../storage/state';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { DecksView } from './DecksView';
import { AddImportView } from './AddImportView';

interface SettingsViewProps {
  state: AppState;
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
  onRestoreState: (restoredState: AppState) => void;
  onResetProgress: () => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

const SECTION_ORDER: SettingsSectionId[] = ['learning', 'voice', 'decks', 'import', 'data'];

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
  {
    title: 'Data',
    items: [
      { id: 'data', label: 'Backup & Reset', icon: ShieldCheck },
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
  state,
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
  onRestoreState,
  onResetProgress,
  onNotify,
}: SettingsViewProps) {
  const tabRefs = useRef<Partial<Record<SettingsSectionId, HTMLButtonElement | null>>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<ParsedBackupResult | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleExportBackup = () => {
    const now = new Date();
    const json = serializeBackup(state, now);
    const filename = `backup-kosakata-${getLocalDateKey(now)}.json`;
    triggerJsonDownload(filename, json);
    onNotify('success', `Backup diunduh (${filename}).`);
  };

  const handleSelectBackupFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseBackup(content);
      if (!parsed.ok) {
        onNotify('error', parsed.error);
        setPendingBackup(null);
      } else {
        setPendingBackup(parsed);
      }
    };
    reader.onerror = () => {
      onNotify('error', 'Gagal membaca file backup JSON.');
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;
    onRestoreState(pendingBackup.payload.state);
    setPendingBackup(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNotify('success', 'Progres dan kartu dari backup JSON dipulihkan.');
  };

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
    <div className="flex flex-col gap-6 pb-8 animate-card-reveal min-w-0">
      <section className="min-w-0">
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em] break-words">
          Setelan
        </h1>
        <p className="mt-1 text-sm text-pretty break-words" style={{ color: 'var(--text-secondary)' }}>
          Kelola preferensi belajar, suara pelafalan, koleksi kosakata, dan backup data Anda dalam satu tempat.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:items-start lg:gap-8 min-w-0">
        <aside className="min-w-0 lg:sticky lg:top-6">
          <div
            role="tablist"
            aria-label="Kategori setelan"
            className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-[clamp(10px,3vw,0.875rem)] sm:grid sm:grid-cols-2 sm:gap-4 lg:flex lg:flex-col lg:gap-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
          >
            {NAV_GROUPS.map((group) => (
              <div
                key={group.title}
                className={`settings-tablist-wrap flex flex-col gap-1.5 min-w-0 ${
                  group.items.length === 1 ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <p
                  className="px-1 lg:px-3 text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.title}
                </p>
                <div
                  className={
                    group.items.length === 1
                      ? 'grid grid-cols-1 gap-2 lg:flex lg:flex-col lg:gap-1'
                      : 'settings-tab-group-grid lg:flex lg:flex-col lg:gap-1'
                  }
                >
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
                        className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl px-[clamp(10px,3vw,0.75rem)] py-2 text-left text-xs sm:text-sm transition-colors ${
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
                          <span className="min-w-0 break-words leading-snug lg:truncate">{item.label}</span>
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
            <div className="flex flex-col gap-6 min-w-0 animate-card-reveal">
              <section className="paper-card rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] min-w-0 break-words flex flex-col gap-5">
                <div className="flex flex-col gap-1 min-w-0">
                  <h2 className="text-base font-bold">Mode Belajar</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
                    Pilih mode tingkat kesulitan. Deck rekomendasi dan tampilan transkrip otomatis menyesuaikan.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0">
                  {LEARNING_PHASES.map((phase) => {
                    const isSelected = phase.id === phaseId;
                    return (
                      <button
                        key={phase.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChangePhase(phase.id)}
                        className="group relative min-w-0 rounded-2xl p-4 text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          border: isSelected
                            ? '1.5px solid var(--accent-solid)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
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

              <section className="paper-card rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] min-w-0 break-words flex flex-col gap-5">
                <div className="flex flex-col gap-1 min-w-0">
                  <h2 className="text-base font-bold">Jatah Kartu Baru Harian</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
                    Pilih ritme nyaman setiap pagi. Antrean review lama tetap otomatis dijaga agar tidak menumpuk.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-w-0">
                  {DAILY_LIMIT_PRESETS.map((preset) => {
                    const isSelected = dailyNewLimit === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => onChangeDailyNewLimit(preset.value)}
                        aria-pressed={isSelected}
                        className="flex min-h-11 min-w-0 items-start justify-between gap-2 rounded-xl p-4 text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                          border: isSelected
                            ? '1.5px solid var(--accent-solid)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
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

              <section className="paper-card rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] min-w-0 break-words flex flex-col gap-5">
                <div className="flex flex-col gap-1 min-w-0">
                  <h2 className="text-base font-bold">Tampilan</h2>
                  <p className="text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-muted)' }}>
                    Atur warna tampilan aplikasi agar nyaman dibaca kapan saja.
                  </p>
                </div>

                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="sr-only">Pilih tema tampilan</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-w-0">
                    {THEME_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = theme === opt.value;
                      const inputId = `settings-theme-${opt.value}`;
                      return (
                        <div key={opt.value} className="relative min-w-0">
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
                            className="flex h-full min-h-11 min-w-0 cursor-pointer flex-col justify-between gap-2 rounded-xl p-4 text-left transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                            style={{
                              backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                              border: isSelected
                                ? '1.5px solid var(--accent-solid)'
                                : '1.5px solid transparent',
                            }}
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span
                                className="inline-flex min-w-0 items-center gap-2 text-sm font-bold"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <Icon
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)' }}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 break-words">{opt.label}</span>
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
            <section className="paper-card rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] min-w-0 break-words flex flex-col gap-6 animate-card-reveal">
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

          {activeSection === 'data' && (
            <section className="paper-card min-w-0 rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] space-y-4 break-words animate-card-reveal">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold">Backup & Pindah Perangkat (JSON)</h2>
                  <p className="text-xs mt-0.5 text-pretty" style={{ color: 'var(--text-secondary)' }}>
                    Seluruh progres FSRS, streak, dan kartu kustom tersimpan aman di browser ini. Unduh backup JSON secara berkala agar mudah dipulihkan di HP atau laptop lain.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-left transition-opacity hover:opacity-95"
                  style={{
                    backgroundColor: 'var(--accent-solid)',
                    color: 'var(--text-on-accent)',
                  }}
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">Export Backup JSON</span>
                </button>

                <div className="relative min-w-0 max-w-full">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    id="backup-json-input"
                    className="sr-only peer"
                    onChange={(e) => handleSelectBackupFile(e.target.files?.[0])}
                  />
                  <label
                    htmlFor="backup-json-input"
                    className="inline-flex min-h-11 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-left transition-colors hover:bg-[var(--bg-hover)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">Import Backup JSON</span>
                  </label>
                </div>
              </div>

              {pendingBackup && (
                <div
                  className="min-w-0 rounded-xl p-4 space-y-3 animate-card-reveal break-words"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1.5px solid var(--accent-solid)',
                  }}
                >
                  <div className="text-sm font-bold">Konfirmasi Pemulihan Backup</div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    File backup valid ditemukan:{' '}
                    <strong className="tabular-nums">{pendingBackup.summary.trackedCards}</strong> kartu berprogres,{' '}
                    <strong className="tabular-nums">{pendingBackup.summary.totalReviews}</strong> total review,{' '}
                    <strong className="tabular-nums">{pendingBackup.summary.customCards}</strong> kartu kustom, dan{' '}
                    <strong className="tabular-nums">{pendingBackup.summary.activeDays}</strong> hari aktif.
                  </p>
                  <div className="flex flex-wrap gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={handleConfirmRestore}
                      className="min-h-11 sm:min-h-9 max-w-full min-w-0 rounded-xl px-4 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--text-on-accent)',
                      }}
                    >
                      Pulihkan Progres
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingBackup(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="min-h-11 sm:min-h-9 max-w-full min-w-0 rounded-xl px-4 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              <div
                className="pt-3 flex flex-wrap items-center justify-between gap-2 min-w-0"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <span className="text-xs min-w-0" style={{ color: 'var(--text-muted)' }}>
                  Ingin mengulang dari awal?
                </span>
                {!confirmingReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="inline-flex min-h-11 sm:min-h-9 max-w-full min-w-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                    style={{ color: 'var(--rate-again-text)' }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Reset Progres</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-medium min-w-0" style={{ color: 'var(--rate-again-text)' }}>
                      Hapus seluruh riwayat review? Kartu kustom tetap disimpan.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onResetProgress();
                        setConfirmingReset(false);
                      }}
                      className="min-h-11 sm:min-h-9 max-w-full min-w-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--rate-again-bg)',
                        border: '1px solid var(--rate-again-border)',
                        color: 'var(--rate-again-text)',
                      }}
                    >
                      Hapus Progres Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="min-h-11 sm:min-h-9 max-w-full min-w-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
