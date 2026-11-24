import { useRef, useState } from 'react';
import {
  Flame,
  Trophy,
  CheckCircle2,
  Target,
  Download,
  Upload,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type { AppState, MasteryBucket } from '../types';
import type { ProgressStats } from '../srs/engine';
import { MASTERY_LABELS } from '../srs/engine';
import {
  parseBackup,
  serializeBackup,
  triggerJsonDownload,
  type ParsedBackupResult,
} from '../importExport/backup';
import { getLocalDateKey } from '../storage/state';

interface ProgressViewProps {
  state: AppState;
  stats: ProgressStats;
  onRestoreState: (restoredState: AppState) => void;
  onResetProgress: () => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

const MASTERY_STYLES: Record<MasteryBucket, { bar: string; soft: string; text: string }> = {
  new: {
    bar: 'var(--border-strong)',
    soft: 'var(--bg-subtle)',
    text: 'var(--text-secondary)',
  },
  learning: {
    bar: 'var(--rate-hard-text)',
    soft: 'var(--rate-hard-bg)',
    text: 'var(--rate-hard-text)',
  },
  mastering: {
    bar: 'var(--rate-easy-text)',
    soft: 'var(--rate-easy-bg)',
    text: 'var(--rate-easy-text)',
  },
  memorized: {
    bar: 'var(--accent-solid)',
    soft: 'var(--accent-soft)',
    text: 'var(--accent-text)',
  },
};

export function ProgressView({
  state,
  stats,
  onRestoreState,
  onResetProgress,
  onNotify,
}: ProgressViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<ParsedBackupResult | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleExportBackup = () => {
    const now = new Date();
    const json = serializeBackup(state, now);
    const filename = `pagikata-backup-${getLocalDateKey(now)}.json`;
    triggerJsonDownload(filename, json);
    onNotify('success', `Backup berhasil diunduh (${filename}).`);
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
    onNotify('success', 'Progres dan kartu dari backup JSON berhasil dipulihkan.');
  };

  const heatColor = (intensity: 0 | 1 | 2 | 3 | 4): string => `var(--heat-${intensity})`;

  return (
    <div className="space-y-6 pb-8 animate-card-reveal">
      <section>
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em]">
          Progres Belajar
        </h1>
        <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
          Ringkasan kebiasaan pagi, penguasaan kosakata, dan perjalanan CEFR A2 → C1 Anda.
        </p>
      </section>

      {/* Top 4 Motivating Metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="paper-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--sun-text)' }}>
            <Flame className="h-4 w-4" />
            <span>Streak Saat Ini</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.currentStreak}
            <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              hari
            </span>
          </div>
        </div>

        <div className="paper-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <Trophy className="h-4 w-4" />
            <span>Rekor Terpanjang</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.longestStreak}
            <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              hari
            </span>
          </div>
        </div>

        <div className="paper-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>
            <CheckCircle2 className="h-4 w-4" />
            <span>Total Review</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.totalReviews}
          </div>
        </div>

        <div className="paper-card rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <Target className="h-4 w-4" />
            <span>Tingkat Ingat</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {stats.retentionRate !== null ? `${stats.retentionRate}%` : '—'}
          </div>
        </div>
      </section>

      {/* 28-Day Activity Calendar */}
      <section className="paper-card rounded-[24px] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Kalender Aktivitas 28 Hari</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Setiap kotak merekam sesi review harian Anda dalam 4 minggu terakhir.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span>Sedikit</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <span
                key={level}
                className="h-3 w-3 rounded-[4px]"
                style={{ backgroundColor: heatColor(level) }}
              />
            ))}
            <span>Aktif</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {stats.calendarDays.map((day) => (
            <div
              key={day.dateKey}
              title={`${day.label}: ${day.reviews} review (${day.newStudied} kartu baru)`}
              className="flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center transition-transform"
              style={{
                backgroundColor: heatColor(day.intensity),
                color:
                  day.intensity >= 3
                    ? 'var(--text-on-accent)'
                    : 'var(--text-primary)',
                border: day.isToday
                  ? '2px solid var(--accent-solid)'
                  : '1px solid transparent',
              }}
            >
              <span className="text-[10px] font-medium opacity-80 leading-none">
                {day.shortDay}
              </span>
              <span className="mt-1 text-xs font-bold tabular-nums leading-none">
                {day.reviews > 0 ? day.reviews : '·'}
              </span>
              <span className="mt-1 text-[9px] opacity-75 leading-none hidden sm:inline">
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Mastery Breakdown + CEFR Breakdown */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Card Mastery Status */}
        <section className="paper-card rounded-[24px] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold">Status Penguasaan Kartu</h2>
            <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Total {stats.totalCards} kartu tersedia di seluruh deck Anda.
            </p>
          </div>

          {/* Stacked Bar */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-subtle)' }}
          >
            {(['memorized', 'mastering', 'learning', 'new'] as MasteryBucket[]).map((bucket) => {
              const count = stats.masteryCounts[bucket];
              const widthPct = stats.totalCards > 0 ? (count / stats.totalCards) * 100 : 0;
              if (widthPct === 0) return null;
              return (
                <div
                  key={bucket}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: MASTERY_STYLES[bucket].bar,
                  }}
                  title={`${MASTERY_LABELS[bucket]}: ${count} kartu`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {(['new', 'learning', 'mastering', 'memorized'] as MasteryBucket[]).map((bucket) => (
              <div
                key={bucket}
                className="rounded-2xl p-3.5"
                style={{ backgroundColor: MASTERY_STYLES[bucket].soft }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: MASTERY_STYLES[bucket].bar }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: MASTERY_STYLES[bucket].text }}
                  >
                    {MASTERY_LABELS[bucket]}
                  </span>
                </div>
                <div className="mt-1.5 text-xl font-bold tabular-nums">
                  {stats.masteryCounts[bucket]}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Progress per CEFR Level */}
        <section className="paper-card rounded-[24px] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold">Progres per Level CEFR</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pantau pertumbuhan kosakata bertahap dari fondasi A2 hingga nuansa C1.
            </p>
          </div>

          <div className="space-y-4">
            {stats.cefrBreakdown.map((item) => (
              <div key={item.level} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 font-bold"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {item.level}
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {item.started} / {item.total} mulai • {item.mastered} dikuasai
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{item.percentStarted}%</span>
                </div>
                <div
                  className="relative h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-subtle)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${item.percentStarted}%`,
                      backgroundColor: 'var(--accent-border)',
                    }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${item.percentMastered}%`,
                      backgroundColor: 'var(--accent-solid)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Backup JSON Export / Import */}
      <section className="paper-card rounded-[24px] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-text)',
            }}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold">Backup & Pindah Perangkat (JSON)</h2>
            <p className="text-xs mt-0.5 text-pretty" style={{ color: 'var(--text-secondary)' }}>
              Seluruh progres FSRS, streak, dan kartu kustom tersimpan aman di browser ini. Unduh backup JSON secara berkala agar mudah dipulihkan di HP atau laptop lain.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-95"
            style={{
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--text-on-accent)',
            }}
          >
            <Download className="h-4 w-4" />
            <span>Export Backup JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            id="backup-json-input"
            className="hidden"
            onChange={(e) => handleSelectBackupFile(e.target.files?.[0])}
          />
          <label
            htmlFor="backup-json-input"
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <Upload className="h-4 w-4" />
            <span>Import Backup JSON</span>
          </label>
        </div>

        {/* Backup Restore Confirmation Card */}
        {pendingBackup && (
          <div
            className="rounded-2xl p-4 space-y-3 animate-card-reveal"
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="rounded-xl px-4 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--text-on-accent)',
                }}
              >
                Ya, Pulihkan Progres
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingBackup(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="rounded-xl px-4 py-2 text-xs font-semibold"
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

        {/* Subtle Guarded Reset Option */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ingin mengulang dari awal?
          </span>
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--rate-again-text)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Progres</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--rate-again-text)' }}>
                Yakin hapus seluruh progres?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmingReset(false);
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--rate-again-bg)',
                  border: '1px solid var(--rate-again-border)',
                  color: 'var(--rate-again-text)',
                }}
              >
                Ya, Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold"
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
    </div>
  );
}
