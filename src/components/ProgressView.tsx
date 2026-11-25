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
import { MASTERY_LABELS, REVIEW_RATINGS } from '../srs/engine';
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
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const defaultDay =
    stats.calendarDays.find((d) => d.isToday) ??
    stats.calendarDays[stats.calendarDays.length - 1];
  const selectedDay =
    stats.calendarDays.find((d) => d.dateKey === selectedDateKey) ?? defaultDay;

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

  const heatColor = (intensity: 0 | 1 | 2 | 3 | 4): string => `var(--heat-${intensity})`;

  return (
    <div className="min-w-0 space-y-6 pb-8 animate-card-reveal">
      <section className="min-w-0">
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em] break-words">
          Progres Belajar
        </h1>
        <p className="mt-1 text-sm text-pretty break-words" style={{ color: 'var(--text-secondary)' }}>
          Ringkasan kebiasaan harian, penguasaan kosakata, dan perkembangan level CEFR A2–C1 Anda.
        </p>
      </section>

      <section className="progress-stats-wrap">
        <div className="progress-stats-grid">
          <div className="paper-card min-w-0 rounded-2xl p-[clamp(12px,3vw,1rem)] space-y-1.5 break-words">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium min-w-0" style={{ color: 'var(--sun-text)' }}>
              <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Streak Saat Ini</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums break-words">
              {stats.currentStreak}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                hari
              </span>
            </div>
          </div>

          <div className="paper-card min-w-0 rounded-2xl p-[clamp(12px,3vw,1rem)] space-y-1.5 break-words">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium min-w-0" style={{ color: 'var(--text-secondary)' }}>
              <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Rekor Terpanjang</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums break-words">
              {stats.longestStreak}
              <span className="ml-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                hari
              </span>
            </div>
          </div>

          <div className="paper-card min-w-0 rounded-2xl p-[clamp(12px,3vw,1rem)] space-y-1.5 break-words">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium min-w-0" style={{ color: 'var(--accent-text)' }}>
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Total Review</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums break-words">
              {stats.totalReviews}
            </div>
          </div>

          <div className="paper-card min-w-0 rounded-2xl p-[clamp(12px,3vw,1rem)] space-y-1.5 break-words">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium min-w-0" style={{ color: 'var(--text-secondary)' }}>
              <Target className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Tingkat Ingat</span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums break-words">
              {stats.retentionRate !== null ? `${stats.retentionRate}%` : '-'}
            </div>
          </div>
        </div>
      </section>

      <section className="paper-card min-w-0 rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] space-y-4 break-words">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Kalender Aktivitas 28 Hari</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pilih tanggal untuk melihat detail sesi review dalam 4 minggu terakhir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0" style={{ color: 'var(--text-muted)' }}>
            <span>Sedikit</span>
            {([0, 1, 2, 3, 4] as const).map((level) => (
              <span
                key={level}
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-[4px]"
                style={{ backgroundColor: heatColor(level) }}
              />
            ))}
            <span>Aktif</span>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-[6px] sm:gap-2 min-w-0">
          {stats.calendarDays.map((day) => {
            const isSelected = selectedDay?.dateKey === day.dateKey;
            const totalPracticed = day.reviews + day.practiceCompleted;
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => setSelectedDateKey(day.dateKey)}
                aria-pressed={isSelected}
                aria-label={`${day.label}, ${totalPracticed} kartu dilatih, ${day.newStudied} kartu baru`}
                className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition-colors"
                style={{
                  backgroundColor: heatColor(day.intensity),
                  color:
                    day.intensity >= 3
                      ? 'var(--text-on-accent)'
                      : 'var(--text-primary)',
                  border: day.isToday || isSelected
                    ? '2px solid var(--accent-solid)'
                    : '1px solid transparent',
                }}
              >
                <span className="text-[11px] font-medium leading-none">
                  {day.shortDay}
                </span>
                <span
                  className="mt-1 text-xs font-bold tabular-nums leading-none"
                  style={totalPracticed === 0 ? { color: 'var(--text-muted)' } : undefined}
                >
                  {totalPracticed}
                </span>
                <span className="mt-1 text-[11px] leading-none hidden sm:inline">
                  {day.label}
                </span>
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs min-w-0"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {selectedDay.label}
              {selectedDay.isToday ? ' (Hari Ini)' : ''}
            </span>
            <div className="flex flex-wrap items-center gap-2.5 tabular-nums min-w-0">
              <span>{selectedDay.reviews} review</span>
              {selectedDay.practiceCompleted > 0 && <span>{selectedDay.practiceCompleted} latihan ulang</span>}
              <span
                aria-hidden="true"
                className="h-3 w-px"
                style={{ backgroundColor: 'var(--border-strong)' }}
              />
              <span>{selectedDay.newStudied} kartu baru</span>
            </div>
          </div>
        )}
        {selectedDay && (
          <section aria-labelledby="daily-rating-title" className="study-calendar-ratings min-w-0">
            <h3 id="daily-rating-title">Penilaian kartu</h3>
            <div className="grid gap-4 min-w-0">
              {[
                { title: 'Listening', counts: selectedDay.listeningRatings },
                { title: 'Tebak Kata', counts: selectedDay.ratings },
              ].map(({ title, counts }) => (
                <div key={title} className="grid gap-2 min-w-0">
                  <h4 className="text-sm font-semibold">{title}</h4>
                  {REVIEW_RATINGS.some(({ key }) => (counts[key] ?? 0) > 0) ? (
                    <dl>
                      {REVIEW_RATINGS.map(({ key, label }) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{counts[key] ?? 0}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>Belum ada penilaian pada tanggal ini.</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 min-w-0">
        <section className="paper-card min-w-0 rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] space-y-4 break-words">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Status Penguasaan Kartu</h2>
            <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Total {stats.totalCards} kartu tersedia di seluruh deck Anda.
            </p>
          </div>

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

          <div className="progress-mastery-wrap">
            <div className="progress-mastery-grid">
              {(['new', 'learning', 'mastering', 'memorized'] as MasteryBucket[]).map((bucket) => (
                <div
                  key={bucket}
                  className="min-w-0 rounded-xl p-[clamp(10px,3vw,0.875rem)] break-words"
                  style={{ backgroundColor: MASTERY_STYLES[bucket].soft }}
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: MASTERY_STYLES[bucket].bar }}
                    />
                    <span
                      className="text-xs font-semibold min-w-0"
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
          </div>
        </section>

        <section className="paper-card min-w-0 rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] space-y-4 break-words">
          <div className="min-w-0">
            <h2 className="text-base font-bold">Progres per Level CEFR</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pantau pertumbuhan kosakata bertahap dari fondasi A2 hingga nuansa C1.
            </p>
          </div>

          <div className="space-y-4 min-w-0">
            {stats.cefrBreakdown.map((item) => (
              <div key={item.level} className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className="rounded-md px-2 py-0.5 font-bold shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {item.level}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums min-w-0" style={{ color: 'var(--text-secondary)' }}>
                      <span>
                        {item.started} / {item.total} mulai
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-3 w-px"
                        style={{ backgroundColor: 'var(--border-strong)' }}
                      />
                      <span>{item.mastered} dikuasai</span>
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums">{item.percentStarted}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progres level ${item.level}`}
                  aria-valuenow={item.percentStarted}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'var(--bg-subtle)' }}
                >
                  <div
                    className="absolute inset-0 origin-left rounded-full transition-transform duration-300"
                    style={{
                      transform: `scaleX(${item.percentStarted / 100})`,
                      backgroundColor: 'var(--accent-border)',
                    }}
                  />
                  <div
                    className="absolute inset-0 origin-left rounded-full transition-transform duration-300"
                    style={{
                      transform: `scaleX(${item.percentMastered / 100})`,
                      backgroundColor: 'var(--accent-solid)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="paper-card min-w-0 rounded-[24px] p-[clamp(12px,3.5vw,1.5rem)] space-y-4 break-words">
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

        <div className="pt-3 flex flex-wrap items-center justify-between gap-2 min-w-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
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
    </div>
  );
}
