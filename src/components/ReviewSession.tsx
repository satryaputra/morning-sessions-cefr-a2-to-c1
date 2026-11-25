import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Play,
  Volume2,
} from 'lucide-react';
import { getStudySentences, normalizeStudyAnswer, type ParsedCloze } from '../srs/cloze';
import type { DailyStudyView } from '../srs/dailyStudy';
import { REVIEW_RATINGS } from '../srs/engine';
import { speakEnglish, stopSpeaking } from '../speech/tts';
import type { DeckDefinition, ReviewRatingKey, StudyStage, UserSettings, VocabCard } from '../types';

interface ReviewSessionProps {
  stage: StudyStage;
  study: DailyStudyView;
  readOnly: boolean;
  settings: UserSettings;
  decks: DeckDefinition[];
  onRate: (card: VocabCard, rating: ReviewRatingKey) => boolean;
  onContinueToCloze?: () => void;
  onFinishStage: () => void;
  onOpenVoiceSettings: () => void;
  onExit: () => void;
}

export function ReviewSession({
  stage,
  study,
  readOnly,
  settings,
  decks,
  onRate,
  onContinueToCloze,
  onFinishStage,
  onOpenVoiceSettings,
  onExit,
}: ReviewSessionProps) {
  const listening = stage === 'listening';
  const title = listening ? 'Listening' : 'Tebak Kata';
  const [frozenReadOnlyIds] = useState<string[] | null>(() => {
    if (!readOnly) return null;
    if (listening) {
      const completed = new Set([...study.plan.listenedIds, ...study.plan.answeredIds]);
      return study.listeningCards
        .filter((card) => completed.has(card.id))
        .map((card) => card.id);
    }
    const answered = new Set(study.plan.answeredIds);
    return study.clozeCards
      .filter((card) => answered.has(card.id))
      .map((card) => card.id);
  });

  const activeClozeCards =
    study.listeningCards.length > 0 && !study.listeningFinished ? [] : study.clozeCards;
  const cards = readOnly && frozenReadOnlyIds
    ? (() => {
        const pool = listening ? study.listeningCards : study.clozeCards;
        const byId = new Map(pool.map((card) => [card.id, card]));
        return frozenReadOnlyIds.flatMap((id) => {
          const card = byId.get(id);
          return card ? [card] : [];
        });
      })()
    : (listening ? study.listeningCards : activeClozeCards);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (readOnly || cards.length === 0) return 0;
    const completedSet = new Set(listening ? study.plan.listenedIds : study.plan.answeredIds);
    const firstPending = cards.findIndex((card) => !completedSet.has(card.id));
    return firstPending >= 0 ? firstPending : cards.length - 1;
  });
  const [finished, setFinished] = useState(false);

  const safeIndex = cards.length > 0 ? Math.min(currentIndex, cards.length - 1) : 0;
  const current = finished ? undefined : cards[safeIndex];
  const total = cards.length;
  const done = Math.min(listening ? study.listenedCount : study.answeredCount, total);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const finishedRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onExit]);

  useEffect(() => {
    if (finished) finishedRef.current?.focus();
  }, [finished]);

  const savedRatings = listening
    ? (study.plan.listeningRatingsByCard ?? {})
    : (study.plan.answeredRatingsByCard ?? {});

  const currentCompleted = current
    ? Boolean(savedRatings[current.id]) ||
      (listening
        ? study.plan.listenedIds.includes(current.id)
        : study.plan.answeredIds.includes(current.id))
    : false;

  const currentLocked = current
    ? readOnly ||
      (listening
        ? study.plan.answeredIds.includes(current.id) ||
          (study.plan.listenedIds.includes(current.id) && !savedRatings[current.id])
        : study.plan.answeredIds.includes(current.id) &&
          (!savedRatings[current.id] ||
            (!study.plan.practiceIds.includes(current.id) &&
              !(
                study.plan.clozeBaselines &&
                Object.prototype.hasOwnProperty.call(study.plan.clozeBaselines, current.id)
              ))))
    : true;

  const lockedNote = currentLocked
    ? readOnly
      ? 'Mode lihat ulang: penilaian tersimpan dari sesi sebelumnya.'
      : listening && current && study.plan.answeredIds.includes(current.id)
        ? 'Penilaian Listening terkunci karena kata ini sudah dijawab di Tebak Kata.'
        : 'Penilaian kartu lama ini terkunci karena data riwayat sebelumnya tidak lengkap.'
    : undefined;

  return (
    <div className="min-h-dvh">
      <header className="study-session-header">
        <div className="study-session-bar">
          <button type="button" className="study-button study-quiet" onClick={onExit}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Hari Ini</span>
          </button>
          <button type="button" className="study-button study-quiet" onClick={onOpenVoiceSettings}>
            <AudioLines size={16} aria-hidden="true" />
            <span>Atur suara</span>
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="study-session">
        <div className="study-session-heading">
          <div>
            <p className="study-date">Sesi {listening ? '1' : '2'} dari 2</p>
            <h1 ref={titleRef} tabIndex={-1} className="study-title">{title}</h1>
          </div>
          {total > 0 && (
            <div className="study-session-progress">
              <span className="tabular-nums">{done} / {total} selesai</span>
              <progress className="study-progress" value={done} max={total} aria-label={`Progres ${title}`} />
            </div>
          )}
        </div>

        {current ? (
          <StudyCard
            key={current.id}
            card={current}
            cardNumber={safeIndex + 1}
            totalCards={total}
            deckName={decks.find((deck) => deck.id === current.deckId)?.title}
            listening={listening}
            isDue={!study.plan.pairedIds.includes(current.id)}
            isPractice={study.plan.practiceIds.includes(current.id)}
            settings={settings}
            selectedRating={savedRatings[current.id]}
            hasCompletedCard={currentCompleted}
            readOnly={readOnly}
            locked={currentLocked}
            lockedNote={lockedNote}
            canGoPrev={safeIndex > 0}
            isLast={safeIndex === total - 1}
            onRate={(rating) => {
              if (!currentLocked) onRate(current, rating);
            }}
            onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            onNext={() => {
              if (safeIndex === total - 1) {
                if (readOnly) {
                  onExit();
                } else if (currentCompleted) {
                  onFinishStage();
                  setFinished(true);
                }
              } else if (readOnly || currentCompleted) {
                setCurrentIndex((prev) => Math.min(total - 1, prev + 1));
              }
            }}
          />
        ) : (
          <section className="study-sheet study-task" aria-labelledby="study-finished">
            <h2 id="study-finished" ref={finishedRef} tabIndex={-1}>
              {listening ? 'Listening selesai' : 'Latihan hari ini selesai'}
            </h2>
            <div className="study-task-actions">
              {listening && onContinueToCloze ? (
                <>
                  <button type="button" className="study-button study-primary" onClick={onContinueToCloze}>
                    <span>Lanjut ke Tebak Kata</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="study-button study-secondary" onClick={onExit}>
                    <span>Kembali ke Hari Ini</span>
                  </button>
                </>
              ) : (
                <button type="button" className="study-button study-primary" onClick={onExit}>
                  <span>Kembali ke Hari Ini</span>
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

interface StudyCardProps {
  card: VocabCard;
  cardNumber: number;
  totalCards: number;
  deckName?: string;
  listening: boolean;
  isDue: boolean;
  isPractice: boolean;
  settings: UserSettings;
  selectedRating?: ReviewRatingKey;
  hasCompletedCard: boolean;
  readOnly: boolean;
  locked: boolean;
  lockedNote?: string;
  canGoPrev: boolean;
  isLast: boolean;
  onRate: (rating: ReviewRatingKey) => void;
  onPrev: () => void;
  onNext: () => void;
}

interface StudyHintItem {
  id: 'definition' | 'sentence';
  label: string;
  text: string;
  lang: 'en' | 'id';
}

function StudyCard({
  card,
  cardNumber,
  totalCards,
  deckName,
  listening,
  isDue,
  isPractice,
  settings,
  selectedRating,
  hasCompletedCard,
  readOnly,
  locked,
  lockedNote,
  canGoPrev,
  isLast,
  onRate,
  onPrev,
  onNext,
}: StudyCardProps) {
  const startRevealed = readOnly || hasCompletedCard;
  const [revealed, setRevealed] = useState(startRevealed);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [audio, setAudio] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [audioSource, setAudioSource] = useState<'sentence' | 'word' | null>(null);
  const [fallback, setFallback] = useState(false);
  const audioJob = useRef(0);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusDetailsRef = useRef(false);

  const sentences = getStudySentences(card);
  const target = sentences.answer;
  const showMaskedTranscript = settings.phaseId === 'phase-1';
  const listeningTranscript: ParsedCloze = sentences.listening.hasMatch ? sentences.listening : {
    ...sentences.listening,
    cleanSentence: `${target}. ${sentences.listening.cleanSentence}`,
    segments: [{ type: 'cloze', value: target }, { type: 'text', value: `. ${sentences.listening.cleanSentence}` }],
  };
  const sentenceTranslation =
    typeof card.sentenceTranslationId === 'string' ? card.sentenceTranslationId.trim() : '';
  const practiceSentenceTranslation =
    typeof card.practiceSentenceTranslationId === 'string' ? card.practiceSentenceTranslationId.trim() : '';
  const activeSentenceTranslation = listening
    ? sentenceTranslation
    : (sentences.hasAlternate ? practiceSentenceTranslation : sentenceTranslation);
  const translation = typeof card.translationId === 'string' ? card.translationId.trim() : '';
  const meaning = translation && !['-', 'Belum ada arti Indonesia', 'Catatan pribadi'].includes(translation)
    ? translation
    : undefined;
  const definition = typeof card.definitionEn === 'string' ? card.definitionEn.trim() : '';
  const safeDefinition = definition && !normalizeStudyAnswer(definition).includes(normalizeStudyAnswer(target))
    ? definition
    : undefined;

  useEffect(() => {
    promptRef.current?.focus();
    return () => {
      audioJob.current += 1;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (shouldFocusDetailsRef.current && revealed) {
      shouldFocusDetailsRef.current = false;
      detailsRef.current?.focus();
    }
  }, [revealed]);

  useEffect(() => {
    if (locked) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey ||
          event.metaKey || event.shiftKey || document.querySelector('dialog[open]')) return;
      const targetEl = event.target as HTMLElement | null;
      if (targetEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl.tagName)) return;
      const choice = REVIEW_RATINGS.find((rating) => rating.shortcut === event.key);
      if (!choice) return;
      event.preventDefault();
      onRate(choice.key);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [locked, onRate]);

  const handleReveal = () => {
    shouldFocusDetailsRef.current = true;
    setRevealed(true);
  };

  const play = (text: string, source: 'sentence' | 'word') => {
    const job = ++audioJob.current;
    setAudio('loading');
    setAudioSource(source);
    setFallback(false);
    const update = (value: typeof audio) => {
      if (job !== audioJob.current) return;
      setAudio(value);
      if (value === 'idle' || value === 'error') {
        setAudioSource(null);
      }
    };
    void speakEnglish({
      text,
      accent: settings.accent,
      rate: settings.speechRate,
      provider: settings.ttsProvider,
      elevenLabs: settings.elevenLabs,
      onStart: () => update('playing'),
      onEnd: () => update('idle'),
      onError: () => update('error'),
      onFallback: () => {
        if (job === audioJob.current) setFallback(true);
      },
    });
  };

  const toggleAudio = (text: string, source: 'sentence' | 'word') => {
    if (audioSource === source && (audio === 'playing' || audio === 'loading')) {
      audioJob.current += 1;
      stopSpeaking();
      setAudio('idle');
      setAudioSource(null);
    } else {
      play(text, source);
    }
  };

  const sentenceAudio = audioSource === 'sentence' ? audio : 'idle';
  const wordAudio = audioSource === 'word' ? audio : 'idle';

  const metadata = isDue ? 'Review terjadwal' : (isPractice ? 'Latihan ulang' : deckName);
  const availableHints: StudyHintItem[] = [];
  if (safeDefinition) {
    availableHints.push({
      id: 'definition',
      label: 'Petunjuk 1 (Deskripsi Inggris)',
      text: safeDefinition,
      lang: 'en',
    });
  }
  if (activeSentenceTranslation) {
    availableHints.push({
      id: 'sentence',
      label: safeDefinition ? 'Petunjuk 2 (Arti kalimat)' : 'Petunjuk (Arti kalimat)',
      text: activeSentenceTranslation,
      lang: 'id',
    });
  }

  const visibleHintCount = !revealed ? Math.min(hintLevel, availableHints.length) : 0;
  const visibleHints = availableHints.slice(0, visibleHintCount);

  const handleToggleHint = () => {
    if (availableHints.length === 0) return;
    setHintLevel((prev) => (prev >= availableHints.length ? 0 : ((prev + 1) as 0 | 1 | 2)));
  };

  const hintButtonLabel =
    hintLevel === 0
      ? 'Minta petunjuk'
      : hintLevel === 1 && availableHints.length > 1
        ? 'Petunjuk 2: Arti kalimat'
        : 'Sembunyikan petunjuk';

  const hintToggleButton = !revealed && availableHints.length > 0 ? (
    <button
      type="button"
      className="study-button study-secondary"
      aria-expanded={hintLevel > 0}
      aria-controls="study-hint"
      onClick={handleToggleHint}
    >
      <span>{hintButtonLabel}</span>
    </button>
  ) : null;

  const audioStatus = audio === 'error'
    ? 'Audio belum bisa diputar. Coba lagi atau periksa setelan suara.'
    : (fallback ? 'Menggunakan suara browser.' : '');
  const canAdvance = readOnly || hasCompletedCard;

  return (
    <section className="study-sheet study-task" aria-labelledby="study-prompt">
      <div className="study-task-context">
        {metadata && <span>{metadata}</span>}
        <span className="tabular-nums">Kartu {cardNumber} dari {totalCards}</span>
      </div>

      {listening ? (
        <>
          <h2 id="study-prompt" ref={promptRef} tabIndex={-1}>
            {showMaskedTranscript ? 'Dengarkan dan tebak kata' : 'Dengarkan kalimat'}
          </h2>
          {(revealed || showMaskedTranscript || visibleHintCount > 0) ? (
            <div className="study-answer">
              {(revealed || showMaskedTranscript) && (
                <>
                  <h3 ref={detailsRef} tabIndex={-1}>Transkrip</h3>
                  <Sentence parsed={listeningTranscript} reveal={revealed} />
                </>
              )}
              {!revealed && availableHints.length > 0 && <HintBox hints={visibleHints} />}
              {revealed && (
                <>
                  <WordDetails
                    card={card}
                    target={target}
                    meaning={meaning}
                    definition={safeDefinition}
                    wordAudio={wordAudio}
                    onToggleWordAudio={() => toggleAudio(target, 'word')}
                  />
                  {activeSentenceTranslation && (
                    <Disclosure title="Terjemahan bahasa Indonesia">
                      <p lang="id">{activeSentenceTranslation}</p>
                    </Disclosure>
                  )}
                </>
              )}
            </div>
          ) : (
            availableHints.length > 0 && <HintBox hints={visibleHints} />
          )}
          <div className="study-audio">
            <button
              type="button"
              className={`study-button ${revealed || canAdvance || sentenceAudio === 'playing' || sentenceAudio === 'loading' ? 'study-secondary' : 'study-primary'}`}
              onClick={() => toggleAudio(listeningTranscript.cleanSentence, 'sentence')}
            >
              {sentenceAudio === 'loading' ? <LoaderCircle size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              <span>
                {sentenceAudio === 'loading' ? 'Batalkan pemuatan audio' : (sentenceAudio === 'playing' ? 'Hentikan audio' : 'Putar kalimat')}
              </span>
            </button>
            {!revealed && (
              <button type="button" className="study-button study-secondary" onClick={handleReveal}>
                <span>{showMaskedTranscript ? 'Lihat kata' : 'Buka transkrip'}</span>
              </button>
            )}
            {hintToggleButton}
          </div>
          {audioStatus && <p className="study-audio-status" role="status">{audioStatus}</p>}
        </>
      ) : (
        <>
          <h2 id="study-prompt" ref={promptRef} tabIndex={-1}>
            {sentences.cloze.hasMatch ? 'Lengkapi kalimat' : 'Ingat kata target'}
          </h2>

          {!revealed ? (
            <>
              <div className="study-answer">
                {sentences.cloze.hasMatch
                  ? <Sentence id="study-question" parsed={sentences.cloze} reveal={false} />
                  : <p id="study-question">{meaning || safeDefinition || 'Gunakan petunjuk untuk mengingat kata target.'}</p>}
                {availableHints.length > 0 && <HintBox hints={visibleHints} />}
              </div>
              <div className="study-task-actions">
                <button type="button" className="study-button study-secondary" onClick={handleReveal}>
                  <span>Lihat jawaban</span>
                </button>
                {hintToggleButton}
              </div>
            </>
          ) : (
            <>
              <div className="study-answer">
                <h3 ref={detailsRef} tabIndex={-1}>Kata target</h3>
                {sentences.cloze.hasMatch
                  ? <Sentence parsed={sentences.cloze} reveal />
                  : <p className="study-sentence" lang="en"><mark>{target}</mark></p>}
                <WordDetails
                  card={card}
                  target={target}
                  meaning={meaning}
                  definition={safeDefinition}
                  wordAudio={wordAudio}
                  onToggleWordAudio={() => toggleAudio(target, 'word')}
                />
                {activeSentenceTranslation && (
                  <Disclosure title="Terjemahan bahasa Indonesia">
                    <p lang="id">{activeSentenceTranslation}</p>
                  </Disclosure>
                )}
              </div>
              <div className="study-task-actions">
                <button
                  type="button"
                  className="study-button study-secondary"
                  onClick={() => toggleAudio(sentences.cloze.cleanSentence, 'sentence')}
                >
                  {sentenceAudio === 'loading' ? <LoaderCircle size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                  <span>
                    {sentenceAudio === 'loading' ? 'Batalkan pemuatan audio' : (sentenceAudio === 'playing' ? 'Hentikan audio' : 'Dengarkan kalimat')}
                  </span>
                </button>
              </div>
              {audioStatus && <p className="study-audio-status" role="status">{audioStatus}</p>}
            </>
          )}
        </>
      )}

      <RatingChoices
        listening={listening}
        selectedRating={selectedRating}
        locked={locked}
        lockedNote={lockedNote}
        onRate={onRate}
      />

      <div className="study-nav-footer">
        <button
          type="button"
          className="study-button study-secondary"
          disabled={!canGoPrev}
          onClick={onPrev}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Sebelumnya</span>
        </button>

        {isLast && readOnly ? (
          <button type="button" className="study-button study-primary" onClick={onNext}>
            <span>Kembali ke Hari Ini</span>
          </button>
        ) : isLast ? (
          <button
            type="button"
            className="study-button study-primary"
            disabled={!canAdvance}
            onClick={onNext}
          >
            <Check size={16} aria-hidden="true" />
            <span>{listening ? 'Selesai Listening' : 'Selesai Tebak Kata'}</span>
          </button>
        ) : (
          <button
            type="button"
            className="study-button study-primary"
            disabled={!canAdvance}
            onClick={onNext}
          >
            <span>Lanjut</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

function RatingChoices({
  listening = false,
  selectedRating,
  locked = false,
  lockedNote,
  onRate,
}: {
  listening?: boolean;
  selectedRating?: ReviewRatingKey;
  locked?: boolean;
  lockedNote?: string;
  onRate: (rating: ReviewRatingKey) => void;
}) {
  return (
    <fieldset className="study-ratings">
      <legend>{listening ? 'Seberapa mudah Anda mengenali kata dari audio?' : 'Seberapa mudah Anda mengingatnya?'}</legend>
      <div className="study-rating-grid">
        {REVIEW_RATINGS.map(({ key, label, shortcut }) => {
          const isSelected = selectedRating === key;
          return (
            <button
              key={key}
              type="button"
              className="study-rating"
              aria-keyshortcuts={shortcut}
              aria-pressed={isSelected}
              disabled={locked}
              onClick={() => onRate(key)}
            >
              <span className="study-rating-label">
                <kbd>{shortcut}</kbd>
                <span>{label}</span>
              </span>
              {isSelected && <Check size={14} className="study-rating-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {locked && lockedNote && (
        <p className="study-rating-note">{lockedNote}</p>
      )}
    </fieldset>
  );
}

function HintBox({ hints }: { hints: StudyHintItem[] }) {
  return (
    <div id="study-hint" role="status" className="study-hints" hidden={hints.length === 0}>
      {hints.map((item) => (
        <div key={item.id} className="study-hint-item">
          <span className="study-hint-label">{item.label}</span>
          <p className="study-hint" lang={item.lang}>{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="study-notes">
      <summary><span>{title}</span><ChevronDown aria-hidden="true" size={16} /></summary>
      <div className="study-note-content">{children}</div>
    </details>
  );
}

function Sentence({ id, parsed, reveal = false }: { id?: string; parsed: ParsedCloze; reveal?: boolean }) {
  return (
    <p id={id} lang="en" className="study-sentence">
      {parsed.segments.map((part, index) => part.type === 'text' ? part.value : (
        reveal
          ? <mark key={index}>{part.value}</mark>
          : (
            <span className="study-blank" key={index}>
              <span className="sr-only" lang="id"> bagian kosong </span>
            </span>
          )
      ))}
    </p>
  );
}

function WordDetails({
  card,
  target,
  meaning,
  definition,
  wordAudio,
  onToggleWordAudio,
}: {
  card: VocabCard;
  target: string;
  meaning?: string;
  definition?: string;
  wordAudio: 'idle' | 'loading' | 'playing' | 'error';
  onToggleWordAudio: () => void;
}) {
  const notes = typeof card.notes === 'string' ? card.notes.trim() : '';
  return (
    <>
      <div className="study-word">
        <div>
          <p><strong lang="en">{target}</strong> {card.ipa && <span className="study-ipa">{card.ipa}</span>}</p>
          {meaning ? <p>{meaning}</p> : (definition && <p lang="en">{definition}</p>)}
        </div>
        <button type="button" className="study-button study-secondary" onClick={onToggleWordAudio}>
          {wordAudio === 'loading' ? <LoaderCircle size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          <span>
            {wordAudio === 'loading'
              ? 'Batalkan pemuatan audio'
              : (wordAudio === 'playing' ? 'Hentikan audio' : 'Dengarkan kata')}
          </span>
        </button>
      </div>
      {(notes || (meaning && definition)) && (
        <Disclosure title="Catatan kata">
          {meaning && definition && <p lang="en">{definition}</p>}
          {notes && <p>{notes}</p>}
        </Disclosure>
      )}
    </>
  );
}
