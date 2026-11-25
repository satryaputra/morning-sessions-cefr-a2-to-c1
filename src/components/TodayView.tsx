import {
  Play,
  Headphones,
  FileText,
  BookOpen,
  Clock,
  CheckCircle2,
  Flame,
  ChevronRight,
  Plus,
  Layers,
} from 'lucide-react';
import type {
  DeckDefinition,
  LearningPhaseId,
  StudyMode,
} from '../types';
import type { DailyQueueResult } from '../srs/engine';
import { LEARNING_PHASES } from '../data';

interface TodayViewProps {
  queueInfo: DailyQueueResult;
  phaseId: LearningPhaseId;
  studyMode: StudyMode;
  streak: number;
  dailyNewLimit: number;
  activeDecks: DeckDefinition[];
  onStartReview: () => void;
  onAddExtraCards: () => void;
  onChangePhase: (phaseId: LearningPhaseId) => void;
  onChangeStudyMode: (mode: StudyMode) => void;
  onGoToDecks: () => void;
}

function formatTodayDate(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

export function TodayView({
  queueInfo,
  phaseId,
  studyMode,
  streak,
  dailyNewLimit,
  activeDecks,
  onStartReview,
  onAddExtraCards,
  onChangePhase,
  onChangeStudyMode,
  onGoToDecks,
}: TodayViewProps) {
  const dateLabel = formatTodayDate();
  const currentPhase = LEARNING_PHASES.find((p) => p.id === phaseId) ?? LEARNING_PHASES[0];

  const totalPlannedToday = queueInfo.reviewsToday + queueInfo.totalCount;
  const completionPct =
    totalPlannedToday === 0
      ? 100
      : Math.min(100, Math.round((queueInfo.reviewsToday / totalPlannedToday) * 100));
  const progressRatio =
    queueInfo.reviewsToday > 0 ? Math.max(0.06, completionPct / 100) : 0;

  const hasCardsToStudy = queueInfo.totalCount > 0;
  const noActiveDecks = activeDecks.length === 0;

  return (
    <div className="space-y-6 pb-8 animate-card-reveal">
      <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {dateLabel}
          </p>
          <h1 className="mt-1 font-serif-study text-3xl sm:text-[34px] font-medium tracking-[-0.015em] leading-[1.15]">
            Sesi Review Hari Ini
          </h1>
        </div>
        <div className="mt-2 sm:mt-0 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {currentPhase.curriculumLabel} ({currentPhase.cefrTarget})
        </div>
      </section>

      <section className="paper-card-elevated rounded-[24px] p-5 sm:p-7">
        {noActiveDecks ? (
          <div className="py-4 text-center space-y-4">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
            >
              <Layers className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Belum ada deck yang aktif</h2>
              <p className="mx-auto max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
                Aktifkan minimal satu deck siap pakai atau pilih fase belajar di bawah untuk mulai sesi pagi Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToDecks}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--text-on-accent)',
              }}
            >
              <span>Buka Daftar Deck</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : hasCardsToStudy ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Sesi Review Pagi
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                    {queueInfo.totalCount}
                  </span>
                  <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                    kartu menunggu
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="tabular-nums">
                    <strong style={{ color: 'var(--text-primary)' }}>{queueInfo.dueCount}</strong> review ulang
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>•</span>
                  <span className="tabular-nums">
                    <strong style={{ color: 'var(--text-primary)' }}>{queueInfo.newCount}</strong> kata baru
                  </span>
                  <span aria-hidden="true" style={{ color: 'var(--border-strong)' }}>•</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    ~{queueInfo.estimatedMinutes} menit
                  </span>
                </div>
              </div>

              <div
                className="inline-flex self-start rounded-2xl p-1"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
                role="group"
                aria-label="Pilih mode belajar"
              >
                <button
                  type="button"
                  onClick={() => onChangeStudyMode('cloze')}
                  aria-pressed={studyMode === 'cloze'}
                  className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: studyMode === 'cloze' ? 'var(--bg-surface)' : 'transparent',
                    color: studyMode === 'cloze' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: studyMode === 'cloze' ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
                  }}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cloze</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeStudyMode('listening')}
                  aria-pressed={studyMode === 'listening'}
                  className="flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: studyMode === 'listening' ? 'var(--bg-surface)' : 'transparent',
                    color: studyMode === 'listening' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: studyMode === 'listening' ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
                  }}
                >
                  <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Listening First</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={onStartReview}
                className="group flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-semibold transition-[transform,opacity] enabled:active:scale-[0.96] hover:opacity-95"
                style={{
                  backgroundColor: 'var(--accent-solid)',
                  color: 'var(--text-on-accent)',
                }}
              >
                <Play className="h-5 w-5 fill-current translate-x-[1px]" aria-hidden="true" />
                <span>
                  {queueInfo.reviewsToday > 0 ? 'Lanjutkan Review' : 'Mulai Review'}
                </span>
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {studyMode === 'listening'
                  ? 'Mode Listening First: audio aksen British (en-GB) dibacakan dulu untuk melatih telinga BBC.'
                  : 'Mode Cloze: ingat frasa dari konteks kalimat utuh tanpa setting teknis yang rumit.'}
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Target hari ini • jatah {dailyNewLimit} kata baru/hari
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {queueInfo.reviewsToday} selesai ({completionPct}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progres review hari ini"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              >
                <div
                  className="h-full w-full origin-left rounded-full transition-transform duration-300"
                  style={{
                    transform: `scaleX(${progressRatio})`,
                    backgroundColor: 'var(--accent-solid)',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-text)',
              }}
            >
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-serif-study text-2xl sm:text-3xl font-medium">
                Sesi pagi Anda selesai
              </h2>
              <p className="mx-auto max-w-md text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
                Anda sudah menyelesaikan{' '}
                <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {queueInfo.reviewsToday} review
                </strong>{' '}
                hari ini. Otak Anda sedang menguatkan memori sampai besok pagi.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {queueInfo.availableExtraNewCount > 0 && (
                <button
                  type="button"
                  onClick={onAddExtraCards}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-[transform,opacity] enabled:active:scale-[0.96] hover:opacity-95"
                  style={{
                    backgroundColor: 'var(--accent-solid)',
                    color: 'var(--text-on-accent)',
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Tambah 5 Kartu Ekstra</span>
                </button>
              )}
              <div
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium tabular-nums"
                style={{
                  backgroundColor: 'var(--sun-soft)',
                  color: 'var(--sun-text)',
                }}
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                <span>Streak terjaga: {streak} hari</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Fase Belajar 12 Bulan Anda
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pilih fase saat ini. Deck siap pakai otomatis menyesuaikan kurikulum BBC Learning English.
            </p>
          </div>
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
                    {phase.monthsLabel}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: isSelected ? 'var(--accent-text)' : 'var(--text-muted)' }}
                  >
                    {phase.cefrTarget}
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

      <section className="paper-card rounded-[20px] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Deck Aktif Hari Ini</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {activeDecks.length > 0
                ? `${activeDecks.length} deck aktif mengalir otomatis ke antrean pagi Anda.`
                : 'Belum ada deck yang diaktifkan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToDecks}
            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: 'var(--accent-text)' }}
          >
            <span>Atur Deck</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {activeDecks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeDecks.map((deck) => (
              <span
                key={deck.id}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>{deck.title}</span>
                <span
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {deck.cefrRange}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
