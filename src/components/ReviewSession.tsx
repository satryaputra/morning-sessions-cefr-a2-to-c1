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
  Flame,
  Gauge,
  AudioLines,
  Loader2,
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
import { parseClozeSentence, stripClozeMarkup } from '../srs/cloze';
import {
  isSpeechSupported,
  prefetchElevenLabsAudio,
  speakEnglish,
  stopSpeaking,
} from '../speech/tts';
import {
  getVoiceIdForAccent,
  getVoiceLabelById,
  loadElevenLabsApiKey,
} from '../speech/elevenlabs';

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
  onOpenVoiceSettings: () => void;
  serverElevenLabsConfigured: boolean;
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
  onOpenVoiceSettings,
  serverElevenLabsConfigured,
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
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [cardAnimKey, setCardAnimKey] = useState(0);

  const { studyMode, showIndonesianHint, accent, speechRate, ttsProvider, elevenLabs } =
    state.settings;
  const currentCard = queue[0] ?? null;
  const nextCard = queue[1] ?? null;
  const speechAvailable = useMemo(() => isSpeechSupported(), []);
  const activeVoiceName = useMemo(
    () => getVoiceLabelById(getVoiceIdForAccent(elevenLabs, accent)),
    [elevenLabs, accent]
  );
  const fallbackNotifiedRef = useRef(false);

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
      if (ttsProvider === 'browser' && !speechAvailable) {
        onNotify('info', 'Browser ini tidak mendukung Web Speech Audio.');
        return;
      }
      void speakEnglish({
        text,
        accent,
        rate: speechRate,
        provider: ttsProvider,
        elevenLabs,
        onLoading: (loading) => setIsLoadingAudio(loading),
        onStart: () => {
          setIsLoadingAudio(false);
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsLoadingAudio(false);
          setIsSpeaking(false);
        },
        onFallback: (reason) => {
          if (!fallbackNotifiedRef.current) {
            fallbackNotifiedRef.current = true;
            onNotify('info', reason);
          }
        },
        onError: () => {
          setIsLoadingAudio(false);
          setIsSpeaking(false);
        },
      });
    },
    [accent, speechRate, ttsProvider, elevenLabs, speechAvailable, onNotify]
  );

  // Reset fallback toast throttle when user switches provider or voice config
  useEffect(() => {
    fallbackNotifiedRef.current = false;
  }, [ttsProvider, elevenLabs]);

  // Stop speech when leaving session
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Auto-play audio in Listening First mode when a new front card appears
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentCard || isFlipped || studyMode !== 'listening') {
      return;
    }
    if (ttsProvider === 'browser' && !speechAvailable) {
      return;
    }
    const token = `${currentCard.id}-${cardAnimKey}-${accent}-${speechRate}-${ttsProvider}`;
    if (lastAutoPlayedRef.current === token) return;
    lastAutoPlayedRef.current = token;

    const cleanSentence = parsedCloze?.cleanSentence ?? currentCard.sentence;
    const timer = window.setTimeout(() => {
      speakText(cleanSentence);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentCard,
    isFlipped,
    studyMode,
    speechAvailable,
    cardAnimKey,
    accent,
    speechRate,
    ttsProvider,
    parsedCloze,
    speakText,
  ]);

  // Quietly prefetch next card's studio audio in Listening First mode for instant transitions
  useEffect(() => {
    if (ttsProvider !== 'elevenlabs' || studyMode !== 'listening' || !nextCard) {
      return;
    }
    const hasCredentials =
      serverElevenLabsConfigured ||
      loadElevenLabsApiKey().length > 0 ||
      Boolean(elevenLabs.customProxyUrl);
    if (!hasCredentials) return;

    const timer = window.setTimeout(() => {
      void prefetchElevenLabsAudio({
        text: stripClozeMarkup(nextCard.sentence),
        accent,
        rate: speechRate,
        elevenLabs,
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    ttsProvider,
    studyMode,
    nextCard,
    accent,
    speechRate,
    elevenLabs,
    serverElevenLabsConfigured,
  ]);

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
    onNotify('info', 'Penilaian terakhir dibatalkan. Silakan nilai ulang.');
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
      onNotify('info', 'Semua kartu di deck aktif sudah Anda pelajari.');
    }
  };

  // Desktop keyboard shortcuts: Space, 1-4, R, Z, H, Esc
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) {
        return;
      }

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
  const progressRatio = totalSteps === 0 ? 1 : sessionReviewed / totalSteps;
  const currentMastery = currentCard ? classifyMastery(state.progress[currentCard.id]) : 'new';

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
    >
      <header
        className="sticky top-0 z-20"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="mx-auto flex min-h-14 max-w-3xl items-center justify-between gap-2 sm:gap-3 px-3 py-1.5 sm:px-4">
          <button
            type="button"
            aria-label="Kembali ke Hari Ini"
            onClick={() => {
              stopSpeaking();
              onExit();
            }}
            className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-0 sm:px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Kembali</span>
          </button>

          <div className="flex min-w-0 flex-1 max-w-xs items-center gap-2 sm:gap-2.5">
            <div
              role="progressbar"
              aria-label="Progres sesi review"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 min-w-6 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-300"
                style={{
                  transform: `scaleX(${progressRatio})`,
                  backgroundColor: 'var(--accent-solid)',
                }}
              />
            </div>
            <span
              className="shrink-0 text-xs font-semibold tabular-nums whitespace-nowrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {currentCard ? `${sessionReviewed + 1} / ${totalSteps}` : `${sessionReviewed} selesai`}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Batalkan penilaian terakhir (Z)"
              aria-label="Undo penilaian terakhir"
              className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-0 sm:px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-35 hover:bg-[var(--bg-subtle)]"
              style={{
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Undo</span>
              <kbd
                className="hidden md:inline-block rounded px-1 py-0.5 text-[11px] font-mono-code"
                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
              >
                Z
              </kbd>
            </button>

            <button
              type="button"
              onClick={onOpenVoiceSettings}
              title={
                ttsProvider === 'elevenlabs'
                  ? `Suara ElevenLabs (${activeVoiceName}) aktif. Klik untuk atur.`
                  : 'Atur aksen & suara pelafalan'
              }
              aria-label="Pengaturan suara"
              className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-0 sm:px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
              style={{
                backgroundColor:
                  ttsProvider === 'elevenlabs' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color:
                  ttsProvider === 'elevenlabs' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <AudioLines className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">
                {ttsProvider === 'elevenlabs' ? activeVoiceName : 'Suara'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeStudyMode(studyMode === 'cloze' ? 'listening' : 'cloze')}
              aria-label={
                studyMode === 'cloze'
                  ? 'Mode Cloze aktif. Beralih ke mode Listening First.'
                  : 'Mode Listening First aktif. Beralih ke mode Cloze.'
              }
              title={
                studyMode === 'cloze'
                  ? 'Beralih ke Mode Listening First'
                  : 'Beralih ke Mode Cloze'
              }
              className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-0 sm:px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
              style={{
                backgroundColor: studyMode === 'listening' ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: studyMode === 'listening' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {studyMode === 'listening' ? (
                <>
                  <Headphones className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Listening</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Cloze</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-between px-4 py-6 sm:py-10"
      >
        {currentCard && parsedCloze ? (
          <>
            <div className="flex flex-1 flex-col justify-center">
              <article
                key={`${currentCard.id}-${cardAnimKey}-${isFlipped ? 'back' : 'front'}`}
                className={`paper-card-elevated rounded-[24px] p-5 sm:p-8 ${
                  isFlipped ? 'animate-card-flip' : 'animate-card-reveal'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-lg px-2.5 py-1 text-xs font-bold"
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

                  <span
                    className="text-xs font-medium text-right leading-snug"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {deckTitleMap.get(currentCard.deckId) ?? 'Deck Aktif'}
                  </span>
                </div>

                {!isFlipped ? (
                  <div className="py-5 sm:py-7 space-y-5">
                    {studyMode === 'listening' && !listeningPeeked ? (
                      <div className="flex flex-col items-center text-center space-y-4 py-1">
                        <div className="space-y-1">
                          <p
                            className="text-xs font-semibold"
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
                          className="group flex h-20 w-20 items-center justify-center rounded-full transition-transform enabled:active:scale-[0.96]"
                          style={{
                            backgroundColor: 'var(--accent-solid)',
                            color: 'var(--text-on-accent)',
                          }}
                          aria-label="Putar audio kalimat bahasa Inggris"
                        >
                          {isLoadingAudio ? (
                            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                          ) : isSpeaking ? (
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
                            <Volume2 className="h-8 w-8" aria-hidden="true" />
                          )}
                        </button>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onChangeAccent(accent === 'en-US' ? 'en-GB' : 'en-US')}
                            className="min-h-11 sm:min-h-9 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            Aksen: {accent === 'en-US' ? 'US (en-US)' : 'UK (en-GB)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeSpeechRate(speechRate === 1.0 ? 0.8 : 1.0)}
                            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{speechRate === 1.0 ? '1.0x Normal' : '0.8x Lambat'}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setListeningPeeked(true)}
                          className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ color: 'var(--accent-text)' }}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Intip Kalimat Cloze</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <p
                          lang="en"
                          className="font-serif-study text-2xl sm:text-[29px] leading-[1.52] tracking-[-0.005em] text-pretty"
                        >
                          {parsedCloze.segments.map((seg, idx) =>
                            seg.type === 'cloze' ? (
                              <span
                                key={idx}
                                className="mx-1 inline-block rounded-xl px-4 py-0.5 align-baseline font-sans text-lg sm:text-xl font-semibold tracking-wider"
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

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        aria-pressed={showIndonesianHint}
                        onClick={onToggleHint}
                        className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                        style={{
                          color: showIndonesianHint ? 'var(--accent-text)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {showIndonesianHint ? (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {showIndonesianHint ? 'Petunjuk ID: Aktif' : 'Tampilkan Petunjuk ID'}
                        </span>
                        <kbd
                          className="hidden md:inline-block rounded px-1 py-0.5 text-[11px] font-mono-code"
                          style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                        >
                          H
                        </kbd>
                      </button>

                      {(studyMode !== 'listening' || listeningPeeked) && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onChangeAccent(accent === 'en-US' ? 'en-GB' : 'en-US')}
                            aria-label={`Aksen pelafalan ${accent === 'en-US' ? 'US' : 'UK'} aktif. Beralih ke aksen ${accent === 'en-US' ? 'UK' : 'US'}.`}
                            title="Ganti aksen pelafalan"
                            className="inline-flex min-h-11 sm:min-h-9 items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Aksen: {accent === 'en-US' ? 'US' : 'UK'}
                          </button>

                          <button
                            type="button"
                            onClick={() => speakText(parsedCloze.cleanSentence)}
                            className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                            style={{
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Dengar Audio</span>
                            <kbd
                              className="hidden md:inline-block rounded px-1 py-0.5 text-[11px] font-mono-code"
                              style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                            >
                              R
                            </kbd>
                          </button>
                        </div>
                      )}
                    </div>

                    {showIndonesianHint && (
                      <div
                        className="rounded-xl px-4 py-3 text-sm animate-card-reveal"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span className="text-xs font-semibold mr-2" style={{ color: 'var(--text-muted)' }}>
                          Petunjuk:
                        </span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {currentCard.translationId}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-6 space-y-6">
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

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => speakText(parsedCloze.cleanSentence)}
                          className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-[transform,opacity] enabled:active:scale-[0.96]"
                          style={{
                            backgroundColor: 'var(--accent-solid)',
                            color: 'var(--text-on-accent)',
                          }}
                          aria-label="Putar audio kalimat lengkap"
                        >
                          {isLoadingAudio ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {isLoadingAudio
                              ? 'Memuat...'
                              : isSpeaking
                                ? 'Memutar...'
                                : 'Putar Kalimat'}
                          </span>
                          <kbd
                            className="hidden md:inline-block rounded px-1 py-0.5 text-[11px] font-mono-code"
                            style={{ backgroundColor: 'oklch(0 0 0 / 0.18)' }}
                          >
                            R
                          </kbd>
                        </button>

                        <button
                          type="button"
                          onClick={() => speakText(currentCard.phrase)}
                          className="min-h-11 sm:min-h-9 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
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
                          onClick={() => onChangeAccent(accent === 'en-US' ? 'en-GB' : 'en-US')}
                          aria-label={`Aksen ${accent === 'en-US' ? 'US' : 'UK'} aktif. Beralih ke aksen ${accent === 'en-US' ? 'UK' : 'US'}.`}
                          className="min-h-11 sm:min-h-9 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                          title="Ganti aksen pelafalan"
                        >
                          {accent === 'en-US' ? 'US' : 'UK'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeSpeechRate(speechRate === 1.0 ? 0.8 : 1.0)}
                          className="min-h-11 sm:min-h-9 rounded-xl px-2.5 py-2 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--bg-hover)]"
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

                    <div
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl p-4"
                      style={{ backgroundColor: 'var(--bg-subtle)' }}
                    >
                      <div>
                        <div
                          className="text-xs font-semibold"
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
                          className="text-xs font-semibold"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Arti ringkas (ID)
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-pretty">
                          {currentCard.translationId}
                        </p>
                      </div>
                    </div>

                    {currentCard.notes && (
                      <div
                        className="rounded-xl px-4 py-3 text-sm leading-relaxed text-pretty"
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

            <div className="mt-6 pt-2 pb-2">
              {!isFlipped ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleFlip}
                    className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-semibold transition-[transform,opacity] enabled:active:scale-[0.96] hover:opacity-95"
                    style={{
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--text-on-accent)',
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
                          className="group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-3 py-3.5 transition-[transform,opacity] enabled:active:scale-[0.96]"
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
                              className="hidden md:inline-block rounded px-1.5 py-0.5 text-[11px] font-mono-code"
                              style={{ backgroundColor: 'oklch(0 0 0 / 0.08)' }}
                            >
                              {option.shortcut}
                            </kbd>
                          </div>
                          <span className="text-xs font-semibold tabular-nums">
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
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="paper-card-elevated w-full max-w-lg rounded-[24px] p-6 sm:p-8 text-center space-y-6 animate-card-reveal">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                }}
              >
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--sun-soft)', color: 'var(--sun-text)' }}
                >
                  Sesi Pagi Tuntas
                </span>
                <h1 className="font-serif-study text-3xl font-medium">
                  Sesi pagi selesai
                </h1>
                <p className="text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
                  Jadwal pengulangan berikutnya sudah otomatis dihitung agar Anda mengulang tepat sebelum lupa.
                </p>
              </div>

              <div
                className="grid grid-cols-3 gap-3 rounded-xl p-4"
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
                    {sessionReviewed > 0 ? `${Math.round((sessionRecalled / sessionReviewed) * 100)}%` : '-'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Terjawab baik
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums" style={{ color: 'var(--sun-text)' }}>
                    <Flame className="h-5 w-5" aria-hidden="true" />
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
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-[transform,opacity] enabled:active:scale-[0.96] hover:opacity-95"
                    style={{
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--text-on-accent)',
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Tambah 5 Kartu Ekstra</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExit}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-hover)]"
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
