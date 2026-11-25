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
  SpeechAccent,
  StudyMode,
} from '../types';
import type { DailyQueueResult } from '../srs/engine';
import { LEARNING_PHASES } from '../data';

interface TodayViewProps {
  queueInfo: DailyQueueResult;
  phaseId: LearningPhaseId;
  studyMode: StudyMode;
  accent: SpeechAccent;
  streak: number;
  dailyNewLimit: number;
  activeDecks: DeckDefinition[];
  onStartReview: () => void;
  onAddExtraCards: () => void;
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
  accent,
  streak,
  dailyNewLimit,
  activeDecks,
  onStartReview,
  onAddExtraCards,
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
        <div
          className="mt-2 sm:mt-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-pretty"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>
            {currentPhase.title} ({currentPhase.cefrTarget})
          </span>
          <span
            aria-hidden="true"
            className="hidden sm:block h-3 w-px"
            style={{ backgroundColor: 'var(--border-strong)' }}
          />
          <span>{activeDecks.length} deck aktif</span>
          <span
            aria-hidden="true"
            className="hidden sm:block h-3 w-px"
            style={{ backgroundColor: 'var(--border-strong)' }}
          />
          <span>Aksen {accent === 'en-US' ? 'US' : 'UK'}</span>
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
                Aktifkan minimal satu deck atau pilih mode belajar di menu Setelan untuk mulai sesi hari ini.
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
                  Sesi Review Harian
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                    {queueInfo.totalCount}
                  </span>
                  <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                    kartu menunggu
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="tabular-nums">
                    <strong style={{ color: 'var(--text-primary)' }}>{queueInfo.dueCount}</strong> review ulang
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden sm:block h-3.5 w-px"
                    style={{ backgroundColor: 'var(--border-strong)' }}
                  />
                  <span className="tabular-nums">
                    <strong style={{ color: 'var(--text-primary)' }}>{queueInfo.newCount}</strong> kata baru
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden sm:block h-3.5 w-px"
                    style={{ backgroundColor: 'var(--border-strong)' }}
                  />
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
                  ? accent === 'en-US'
                    ? 'Mode Listening First: audio aksen American (en-US) dibacakan dulu sebelum teks ditampilkan.'
                    : 'Mode Listening First: audio aksen British (en-GB) dibacakan dulu sebelum teks ditampilkan.'
                  : 'Mode Cloze: ingat frasa dari konteks kalimat utuh tanpa pengaturan teknis yang rumit.'}
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs font-medium">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Target hari ini
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Jatah {dailyNewLimit} kata baru/hari
                  </span>
                </div>
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
                Sesi hari ini selesai
              </h2>
              <p className="mx-auto max-w-md text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
                Anda sudah menyelesaikan{' '}
                <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {queueInfo.reviewsToday} review
                </strong>{' '}
                hari ini. Jadwal pengulangan berikutnya sudah disiapkan.
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
    </div>
  );
}
