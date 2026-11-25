import { Check, ChevronRight, Headphones, PenLine } from 'lucide-react';
import type { DeckDefinition, StudyStage } from '../types';
import type { DailyStudyView } from '../srs/dailyStudy';
import './study.css';

interface TodayViewProps {
  study: DailyStudyView;
  activeDecks: DeckDefinition[];
  onStart: () => void;
  onStartStage: (stage: StudyStage) => void;
  onAddExtra: () => void;
  onGoToDecks: () => void;
}

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function TodayView({
  study,
  activeDecks,
  onStart,
  onStartStage,
  onAddExtra,
  onGoToDecks,
}: TodayViewProps) {
  const listeningTotal = study.listeningCards.length;
  const clozeTotal = study.clozeCards.length;
  const needsListening = listeningTotal > 0 && !study.listeningFinished;
  const needsCloze = clozeTotal > 0 && !study.clozeFinished;
  const noDecks = activeDecks.length === 0 && !needsCloze;
  const agendaNote = study.dueCount > 0
    ? `${study.dueCount} kata lama menunggu di akhir Tebak Kata.`
    : (!needsListening ? 'Progres tersimpan jika Anda kembali nanti.' : '');
  const nextAction = needsListening
    ? (study.listenedCount ? 'Lanjutkan Listening' : 'Mulai Listening')
    : (study.answeredCount ? 'Lanjutkan Tebak Kata' : (listeningTotal ? 'Lanjut ke Tebak Kata' : 'Mulai Tebak Kata'));
  const steps = [
    {
      stage: 'listening' as const,
      title: 'Listening',
      description: 'Dengar bunyi dan arti kata',
      icon: Headphones,
      done: study.listenedCount,
      total: listeningTotal,
      finished: study.listeningFinished,
      current: needsListening,
      clickable: listeningTotal > 0,
      empty: 'Tidak ada sesi',
    },
    {
      stage: 'cloze' as const,
      title: 'Tebak Kata',
      description: listeningTotal
        ? 'Tebak kata yang hilang dalam kalimat'
        : 'Ingat kembali kata yang sudah dipelajari',
      icon: PenLine,
      done: study.answeredCount,
      total: clozeTotal,
      finished: study.clozeFinished,
      current: !needsListening && needsCloze,
      clickable: !needsListening && clozeTotal > 0,
      empty: 'Tidak ada sesi',
    },
  ];

  return (
    <div className="study-home">
      <header className="study-home-heading">
        <div>
          <p className="study-date">{dateFormat.format(new Date())}</p>
          <h1 id="today-title" className="study-title" tabIndex={-1}>Latihan hari ini</h1>
        </div>
      </header>

      <section className="study-sheet" aria-label="Rencana latihan hari ini">
        <div className="study-agenda">
          <ol className="study-steps">
            {steps.map(({ stage, title, description, icon: Icon, done, total, finished, current, clickable, empty }) => {
              const content = (
                <>
                  <span className="study-step-icon">
                    {finished ? <Check size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
                  </span>
                  <div className="study-step-copy">
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                  <span className="study-step-meta">
                    <span className="study-step-count">
                      {total ? `${done} / ${total}` : empty}
                      {finished && <span className="sr-only"> selesai</span>}
                    </span>
                    {clickable && (
                      <span className="study-step-action-hint">
                        {finished && <span className="study-step-revisit">Lihat ulang</span>}
                        <ChevronRight size={16} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </>
              );

              return (
                <li key={title}>
                  {clickable ? (
                    <button
                      type="button"
                      className="study-step study-step-button"
                      aria-current={current ? 'step' : undefined}
                      onClick={() => onStartStage(stage)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="study-step" aria-current={current ? 'step' : undefined}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="study-agenda-action">
            {noDecks ? (
              <>
                <p>Aktifkan deck untuk mulai berlatih.</p>
                <button type="button" className="study-button study-primary" onClick={onGoToDecks}>Buka daftar deck</button>
              </>
            ) : needsCloze ? (
              <>
                <button type="button" className="study-button study-primary" onClick={onStart}>{nextAction}</button>
                {agendaNote && <p>{agendaNote}</p>}
              </>
            ) : (
              <>
                <p>{clozeTotal ? 'Latihan hari ini selesai.' : 'Belum ada kata yang perlu dilatih.'}</p>
                {study.extraCount > 0 && (
                  <button type="button" className="study-button study-secondary" onClick={onAddExtra}>
                    Tambah {study.extraCount} kata baru
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="study-quota" aria-label="Jatah kata baru">
          <h2>Kata baru</h2>
          <p className="study-quota-value">
            {study.newStudiedToday}<span> / {study.totalNewQuotaToday}</span>
          </p>
          <progress
            className="study-progress"
            value={Math.min(study.newStudiedToday, study.totalNewQuotaToday)}
            max={study.totalNewQuotaToday}
            aria-label="Progres jatah kata baru"
          />
          <p className="study-quota-caption">Dihitung setelah dijawab di Tebak Kata</p>
        </aside>
      </section>
    </div>
  );
}
