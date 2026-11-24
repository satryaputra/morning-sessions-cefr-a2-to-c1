import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  RotateCcw,
  Eye,
  EyeOff,
  Headphones,
  FileText,
  CheckCircle2,
  Plus,
  Sparkles,
  Flame,
  Gauge,
} from 'lucide-react';
import type {
  AppState,
  DeckDefinition,
  ReviewRatingKey,
  SpeechAccent,
  SpeechRate,
  StudyMode,
  VocabCard,
} from '../types';
import {
  applyCardReview,
  classifyMastery,
  previewRatingOptions,
  type UndoSnapshot,
} from '../srs/engine';
import { parseClozeSentence } from '../srs/cloze';
import { isSpeechSupported, speakEnglish, stopSpeaking } from '../speech/tts';

interface ReviewSessionProps {
  initialQueue: VocabCard[];
  state: AppState;
  decks: DeckDefinition[];
  streak: number;
  availableExtraNewCount: number;
  onCommitState: (nextState: AppState) => void;
  onUndoSnapshot: (snapshot: UndoSnapshot) => void;
  onGrantExtraAndGetCards: () => VocabCard[];
  onChangeStudyMode: (mode: StudyMode) => void;
  onToggleHint: () => void;
  onChangeAccent: (accent: SpeechAccent) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onExit: () => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

interface SessionUndoEntry {
  snapshot: UndoSnapshot;
  previousQueue: VocabCard[];
  sessionReviewedBefore: number;
  sessionRecalledBefore: number;
}

const RATING_STYLES: Record<
  ReviewRatingKey,
  { bg: string; hover: string; border: string; text: string }
> = {
  again: {
    bg: 'var(--rate-again-bg)',
    hover: 'var(--rate-again-hover)',
    border: 'var(--rate-again-border)',
    text: 'var(--rate-again-text)',
  },
  hard: {
    bg: 'var(--rate-hard-bg)',
    hover: 'var(--rate-hard-hover)',
    border: 'var(--rate-hard-border)',
    text: 'var(--rate-hard-text)',
  },
  good: {
    bg: 'var(--rate-good-bg)',
    hover: 'var(--rate-good-hover)',
    border: 'var(--rate-good-border)',
    text: 'var(--rate-good-text)',
  },
  easy: {
    bg: 'var(--rate-easy-bg)',
    hover: 'var(--rate-easy-hover)',
    border: 'var(--rate-easy-border)',
    text: 'var(--rate-easy-text)',
  },
};

export function ReviewSession({
  initialQueue,
  state,
  decks,
  streak,
  availableExtraNewCount,
  onCommitState,
  onUndoSnapshot,
  onGrantExtraAndGetCards,
  onChangeStudyMode,
  onToggleHint,
  onChangeAccent,
  onChangeSpeechRate,
  onExit,
  onNotify,
}: ReviewSessionProps) {
  const [queue, setQueue] = useState<VocabCard[]>(initialQueue);
  const [isFlipped, setIsFlipped] = useState(false);
  const [listeningPeeked, setListeningPeeked] = useState(false);
  const [undoStack, setUndoStack] = useState<SessionUndoEntry[]>([]);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionRecalled, setSessionRecalled] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cardAnimKey, setCardAnimKey] = useState(0);

  const { studyMode, showIndonesianHint, accent, speechRate } = state.settings;
  const currentCard = queue[0] ?? null;
  const speechAvailable = useMemo(() => isSpeechSupported(), []);

  const deckTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    decks.forEach((d) => map.set(d.id, d.title));
    return map;
  }, [decks]);

  const parsedCloze = useMemo(() => {
    if (!currentCard) return null;
    return parseClozeSentence(currentCard.sentence, currentCard.phrase);
  }, [currentCard]);

  const ratingOptions = useMemo(() => {
    if (!currentCard) return [];
    return previewRatingOptions(state.progress[currentCard.id], new Date());
  }, [currentCard, state.progress]);

  const speakText = useCallback(
    (text: string) => {
      if (!speechAvailable) {
        onNotify('info', 'Browser ini tidak mendukung Web Speech Audio.');
        return;
      }
      speakEnglish({
        text,
        accent,
        rate: speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [accent, speechRate, speechAvailable, onNotify]
  );

  // Stop speech when leaving session
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Auto-play audio in Listening First mode when a new front card appears
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentCard || isFlipped || studyMode !== 'listening' || !speechAvailable) {
      return;
    }
    const token = `${currentCard.id}-${cardAnimKey}-${accent}-${speechRate}`;
    if (lastAutoPlayedRef.current === token) return;
    lastAutoPlayedRef.current = token;

    const cleanSentence = parsedCloze?.cleanSentence ?? currentCard.sentence;
    const timer = window.setTimeout(() => {
      speakEnglish({
        text: cleanSentence,
        accent,
        rate: speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentCard, isFlipped, studyMode, speechAvailable, cardAnimKey, accent, speechRate, parsedCloze]);

  const handleFlip = useCallback(() => {
    if (!currentCard || isFlipped) return;
    setIsFlipped(true);
  }, [currentCard, isFlipped]);

  const handleRate = useCallback(
    (ratingKey: ReviewRatingKey) => {
      if (!currentCard || !isFlipped) return;
      stopSpeaking();
      setIsSpeaking(false);

      const { nextState, undoSnapshot, shouldRequeueInSession } = applyCardReview(
        state,
        currentCard,
        ratingKey,
        new Date()
      );

      const previousQueue = [...queue];
      const rest = queue.slice(1);
      let nextQueue = rest;

      if (shouldRequeueInSession) {
        const insertIndex = Math.min(2, rest.length);
        nextQueue = [...rest.slice(0, insertIndex), currentCard, ...rest.slice(insertIndex)];
      }

      setUndoStack((prev) => [
        ...prev.slice(-19),
        {
          snapshot: undoSnapshot,
          previousQueue,
          sessionReviewedBefore: sessionReviewed,
          sessionRecalledBefore: sessionRecalled,
        },
      ]);

      onCommitState(nextState);
      setSessionReviewed((c) => c + 1);
      if (ratingKey !== 'again') {
        setSessionRecalled((c) => c + 1);
      }

      setQueue(nextQueue);
      setIsFlipped(false);
      setListeningPeeked(false);
      setCardAnimKey((k) => k + 1);
    },
    [currentCard, isFlipped, state, queue, sessionReviewed, sessionRecalled, onCommitState]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    stopSpeaking();
    setIsSpeaking(false);

    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    onUndoSnapshot(last.snapshot);
    setQueue(last.previousQueue);
    setSessionReviewed(last.sessionReviewedBefore);
    setSessionRecalled(last.sessionRecalledBefore);
    setIsFlipped(true);
    setListeningPeeked(true);
    setCardAnimKey((k) => k + 1);
    onNotify('info', 'Penilaian terakhir dibatalkan — silakan nilai ulang.');
  }, [undoStack, onUndoSnapshot, onNotify]);

  const handleAddExtraInSession = () => {
    const newBatch = onGrantExtraAndGetCards();
    if (newBatch.length > 0) {
      setQueue(newBatch);
      setIsFlipped(false);
      setListeningPeeked(false);
      setCardAnimKey((k) => k + 1);
      onNotify('success', `${newBatch.length} kartu ekstra ditambahkan ke sesi ini.`);
    } else {
      onNotify('info', 'Semua kartu di deck aktif sudah Anda pelajari!');
    }
  };

  // Desktop keyboard shortcuts: Space, 1-4, R, Z, H, Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      if (event.code === 'Space' || key === ' ') {
        if (currentCard && !isFlipped) {
          event.preventDefault();
          handleFlip();
        }
        return;
      }

      if (isFlipped && currentCard) {
        if (key === '1') {
          event.preventDefault();
          handleRate('again');
          return;
        }
        if (key === '2') {
          event.preventDefault();
          handleRate('hard');
          return;
        }
        if (key === '3') {
          event.preventDefault();
          handleRate('good');
          return;
        }
        if (key === '4') {
          event.preventDefault();
          handleRate('easy');
          return;
        }
      }

      if (key === 'r' && currentCard) {
        event.preventDefault();
        speakText(parsedCloze?.cleanSentence ?? currentCard.sentence);
        return;
      }

      if (key === 'z' && undoStack.length > 0) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === 'h' && currentCard) {
        event.preventDefault();
        onToggleHint();
        return;
      }

      if (key === 'escape') {
        event.preventDefault();
        stopSpeaking();
        onExit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentCard,
    isFlipped,
    handleFlip,
    handleRate,
    handleUndo,
    undoStack.length,
    speakText,
    parsedCloze,
    onToggleHint,
    onExit,
  ]);

  const totalSteps = sessionReviewed + queue.length;
  const progressPct = totalSteps === 0 ? 100 : Math.round((sessionReviewed / totalSteps) * 100);
  const currentMastery = currentCard ? classifyMastery(state.progress[currentCard.id]) : 'new';

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
    >
      {/* Minimalist Full-Focus Top Bar */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--bg-canvas) 90%, transparent)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onExit();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </button>

          {/* Progress Track */}
          <div className="flex flex-1 max-w-xs items-center gap-2.5">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: 'var(--accent-solid)',
                }}
              />
            </div>
            <span
              className="text-xs font-semibold tabular-nums whitespace-nowrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {currentCard ? `${sessionReviewed + 1} / ${totalSteps}` : `${sessionReviewed} selesai`}
            </span>
          </div>

          {/* Right Quick Actions: Undo + Mode */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Batalkan penilaian terakhir (Z)"
              aria-label="Undo penilaian terakhir"
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 hover:bg-[var(--bg-subtle)]"
              style={{
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
              <kbd
                className="hidden md:inline-block rounded px-1 py-0.5 text-[10px] font-mono-code"
                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                Z
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => onChangeStudyMode(studyMode === 'cloze' ? 'listening' : 'cloze')}
              title={
                studyMode === 'cloze'
                  ? 'Beralih ke Mode Listening First'
                  : 'Beralih ke Mode Cloze'
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
              style={{
                backgroundColor: studyMode === 'listening' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: studyMode === 'listening' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {studyMode === 'listening' ? (
                <>
                  <Headphones className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Listening</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cloze</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Study Canvas */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between px-4 py-6 sm:py-10">
        {currentCard && parsedCloze ? (
          <>
            {/* Flashcard Container */}
            <div className="flex flex-1 flex-col justify-center">
              <article
                key={`${currentCard.id}-${cardAnimKey}-${isFlipped ? 'back' : 'front'}`}
                className={`paper-card-elevated rounded-[28px] p-6 sm:p-9 ${
                  isFlipped ? 'animate-card-flip' : 'animate-card-reveal'
                }`}
              >
                {/* Card Metadata Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {currentCard.cefr}
                    </span>
                    <span
                      className="rounded-lg px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {currentCard.partOfSpeech}
                    </span>
                    <span
                      className="hidden sm:inline-block rounded-lg px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {currentMastery === 'new' ? 'Kartu Baru' : 'Review'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="max-w-[160px] truncate text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}
                      title={deckTitleMap.get(currentCard.deckId)}
                    >
                      {deckTitleMap.get(currentCard.deckId) ?? 'Deck Aktif'}
                    </span>
                  </div>
                </div>

                {/* FRONT FACE */}
                {!isFlipped ? (
                  <div className="py-5 sm:py-7 space-y-5">
                    {studyMode === 'listening' && !listeningPeeked ? (
                      /* Listening-First Audio Front */
                      <div className="flex flex-col items-center text-center space-y-4 py-1">
                        <div className="space-y-1">
                          <p
                            className="text-xs font-semibold uppercase tracking-[0.06em]"
                            style={{ color: 'var(--accent-text)' }}
                          >
                            Mode Listening First
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Dengarkan kalimatnya terlebih dahulu, lalu bayangkan frasa targetnya.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => speakText(parsedCloze.cleanSentence)}
                          className="group flex h-20 w-20 items-center justify-center rounded-full transition-transform active:scale-95"
                          style={{
                            backgroundColor: 'var(--accent-solid)',
                            color: 'var(--text-on-accent)',
                            boxShadow: '0 10px 28px -8px oklch(0.415 0.084 174 / 0.5)',
                          }}
                          aria-label="Putar audio kalimat bahasa Inggris"
                        >
                          {isSpeaking ? (
                            <span className="flex items-end gap-1 h-7" aria-hidden="true">
                              <span className="w-1.5 h-5 rounded-full bg-current animate-sound-bar" />
                              <span
                                className="w-1.5 h-7 rounded-full bg-current animate-sound-bar"
                                style={{ animationDelay: '0.15s' }}
                              />
                              <span
                                className="w-1.5 h-4 rounded-full bg-current animate-sound-bar"
                                style={{ animationDelay: '0.3s' }}
                              />
                              <span
                                className="w-1.5 h-6 rounded-full bg-current animate-sound-bar"
                                style={{ animationDelay: '0.45s' }}
                              />
                            </span>
                          ) : (
                            <Volume2 className="h-8 w-8" />
                          )}
                        </button>

                        {/* Accent & Speed Quick Pills */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onChangeAccent(accent === 'en-GB' ? 'en-US' : 'en-GB')}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            Aksen: {accent === 'en-GB' ? 'UK (en-GB)' : 'US (en-US)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeSpeechRate(speechRate === 1.0 ? 0.8 : 1.0)}
                            className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <Gauge className="h-3.5 w-3.5" />
                            <span>{speechRate === 1.0 ? '1.0x Normal' : '0.8x Lambat'}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setListeningPeeked(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Intip Kalimat Cloze</span>
                        </button>
                      </div>
                    ) : (
                      /* Default Cloze Sentence Front */
                      <div className="space-y-6">
                        <p
                          lang="en"
                          className="font-serif-study text-2xl sm:text-[29px] leading-[1.52] tracking-[-0.005em] text-pretty"
                        >
                          {parsedCloze.segments.map((seg, idx) =>
                            seg.type === 'cloze' ? (
                              <span
                                key={idx}
                                className="mx-1 inline-block rounded-xl px-4 py-0.5 align-baseline font-sans text-lg sm:text-xl font-semibold tracking-widest"
                                style={{
                                  backgroundColor: 'var(--accent-soft)',
                                  color: 'var(--accent-text)',
                                  borderBottom: '2px dashed var(--accent-solid)',
                                }}
                                aria-label="bagian kosong"
                              >
                                _____
                              </span>
                            ) : (
                              <span key={idx}>{seg.value}</span>
                            )
                          )}
                        </p>

                        {!parsedCloze.hasMatch && (
                          <div
                            className="rounded-xl px-3.5 py-2.5 text-xs"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Ingat frasa target yang sesuai dengan konteks kalimat di atas.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Optional Toggleable Indonesian Hint Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onToggleHint}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                        style={{
                          color: showIndonesianHint ? 'var(--accent-text)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {showIndonesianHint ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {showIndonesianHint ? 'Petunjuk ID: Aktif' : 'Tampilkan Petunjuk ID'}
                        </span>
                        <kbd
                          className="hidden md:inline-block rounded px-1 py-0.5 text-[10px] font-mono-code"
                          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                        >
                          H
                        </kbd>
                      </button>

                      {(studyMode !== 'listening' || listeningPeeked) && (
                        <button
                          type="button"
                          onClick={() => speakText(parsedCloze.cleanSentence)}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Dengar Audio</span>
                          <kbd
                            className="hidden md:inline-block rounded px-1 py-0.5 text-[10px] font-mono-code"
                            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                          >
                            R
                          </kbd>
                        </button>
                      )}
                    </div>

                    {showIndonesianHint && (
                      <div
                        className="rounded-2xl px-4 py-3 text-sm animate-card-reveal"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide mr-2" style={{ color: 'var(--text-muted)' }}>
                          Petunjuk:
                        </span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {currentCard.translationId}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* BACK FACE — Full Context, IPA, EN Definition, ID Meaning, Notes & Audio */
                  <div className="pt-6 space-y-6">
                    {/* Highlighted Target Phrase + IPA + Audio Controls */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2
                          lang="en"
                          className="text-2xl sm:text-3xl font-bold tracking-tight"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          {currentCard.phrase}
                        </h2>
                        {currentCard.ipa && (
                          <p
                            className="mt-1 font-mono-code text-sm"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {currentCard.ipa}
                          </p>
                        )}
                      </div>

                      {/* Audio Playback Bar */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => speakText(parsedCloze.cleanSentence)}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95"
                          style={{
                            backgroundColor: 'var(--accent-solid)',
                            color: 'var(--text-on-accent)',
                          }}
                          aria-label="Putar audio kalimat lengkap"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>{isSpeaking ? 'Memutar…' : 'Putar Kalimat'}</span>
                          <kbd
                            className="hidden md:inline-block rounded px-1 py-0.5 text-[10px] font-mono-code opacity-80"
                            style={{ backgroundColor: 'oklch(0 0 0 / 0.16)' }}
                          >
                            R
                          </kbd>
                        </button>

                        <button
                          type="button"
                          onClick={() => speakText(currentCard.phrase)}
                          className="rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-primary)',
                          }}
                          title="Putar frasa target saja"
                        >
                          Frasa
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeAccent(accent === 'en-GB' ? 'en-US' : 'en-GB')}
                          className="rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                          title="Ganti aksen pelafalan"
                        >
                          {accent === 'en-GB' ? 'UK' : 'US'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeSpeechRate(speechRate === 1.0 ? 0.8 : 1.0)}
                          className="rounded-xl px-2.5 py-2 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                          title="Ganti kecepatan baca"
                        >
                          {speechRate === 1.0 ? '1.0x' : '0.8x'}
                        </button>
                      </div>
                    </div>

                    {/* Complete Sentence with Target Highlighted */}
                    <p
                      lang="en"
                      className="font-serif-study text-xl sm:text-2xl leading-[1.55] text-pretty"
                    >
                      {parsedCloze.segments.map((seg, idx) =>
                        seg.type === 'cloze' ? (
                          <mark
                            key={idx}
                            className="rounded-lg px-1.5 py-0.5 font-semibold"
                            style={{
                              backgroundColor: 'var(--accent-soft)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            {seg.value}
                          </mark>
                        ) : (
                          <span key={idx}>{seg.value}</span>
                        )
                      )}
                    </p>

                    {/* Structured Meaning & Usage Notes */}
                    <div
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl p-4"
                      style={{ backgroundColor: 'var(--bg-subtle)' }}
                    >
                      <div>
                        <div
                          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Definisi (English)
                        </div>
                        <p lang="en" className="mt-1 text-sm leading-relaxed text-pretty">
                          {currentCard.definitionEn}
                        </p>
                      </div>
                      <div>
                        <div
                          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Arti Ringkas (ID)
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-pretty">
                          {currentCard.translationId}
                        </p>
                      </div>
                    </div>

                    {currentCard.notes && (
                      <div
                        className="rounded-2xl px-4 py-3 text-sm leading-relaxed text-pretty"
                        style={{
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          className="font-semibold mr-1.5"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          Catatan & Collocation:
                        </span>
                        {currentCard.notes}
                      </div>
                    )}
                  </div>
                )}
              </article>
            </div>

            {/* Bottom Action Zone (Thumb-Friendly + Desktop Shortcuts) */}
            <div className="mt-6 pt-2 pb-2">
              {!isFlipped ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleFlip}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-semibold transition-all active:scale-[0.99] hover:opacity-95"
                    style={{
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--text-on-accent)',
                      boxShadow: '0 6px 20px -6px oklch(0.415 0.084 174 / 0.45)',
                    }}
                  >
                    <span>Lihat Jawaban</span>
                    <kbd
                      className="hidden md:inline-block rounded-md px-2 py-0.5 text-xs font-mono-code"
                      style={{ backgroundColor: 'oklch(0 0 0 / 0.18)' }}
                    >
                      Space
                    </kbd>
                  </button>
                  <p className="hidden md:block text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    Pintasan: <span className="font-mono-code">Space</span> balik kartu •{' '}
                    <span className="font-mono-code">R</span> audio •{' '}
                    <span className="font-mono-code">H</span> petunjuk ID •{' '}
                    <span className="font-mono-code">Z</span> undo
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Seberapa mudah Anda mengingat frasa ini?
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {ratingOptions.map((option) => {
                      const palette = RATING_STYLES[option.key];
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleRate(option.key)}
                          className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-3.5 transition-all active:scale-[0.97]"
                          style={{
                            backgroundColor: palette.bg,
                            border: `1.5px solid ${palette.border}`,
                            color: palette.text,
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm sm:text-[15px] font-bold">
                              {option.label}
                            </span>
                            <kbd
                              className="hidden md:inline-block rounded px-1.5 py-0.5 text-[10px] font-mono-code opacity-80"
                              style={{ backgroundColor: 'oklch(0 0 0 / 0.08)' }}
                            >
                              {option.shortcut}
                            </kbd>
                          </div>
                          <span className="text-xs font-semibold tabular-nums opacity-85">
                            {option.intervalLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Session Completion View */
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="paper-card-elevated w-full max-w-lg rounded-[28px] p-7 sm:p-9 text-center space-y-6 animate-card-reveal">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--sun-soft)', color: 'var(--sun-text)' }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Sesi Pagi Tuntas
                </span>
                <h1 className="font-serif-study text-3xl font-medium">
                  Kerja bagus pagi ini!
                </h1>
                <p className="text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
                  Jadwal pengulangan berikutnya sudah otomatis dihitung agar Anda mengulang tepat sebelum lupa.
                </p>
              </div>

              <div
                className="grid grid-cols-3 gap-3 rounded-2xl p-4"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <div>
                  <div className="text-2xl font-bold tabular-nums">{sessionReviewed}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Kartu direview
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums">
                    {sessionReviewed > 0 ? `${Math.round((sessionRecalled / sessionReviewed) * 100)}%` : '—'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Terjawab baik
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--sun-text)' }}>
                    <Flame className="h-5 w-5" />
                    <span>{streak}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Hari streak
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                {availableExtraNewCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAddExtraInSession}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold transition-all hover:opacity-95"
                    style={{
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--text-on-accent)',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah 5 Kartu Ekstra</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExit}
                  className="flex flex-1 items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Kembali ke Hari Ini
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
