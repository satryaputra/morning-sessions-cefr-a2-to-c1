import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState,
  DailyNewPreset,
  DeckDefinition,
  ElevenLabsSettings,
  LearningPhaseId,
  NavTab,
  SpeechAccent,
  SpeechRate,
  StudyMode,
  TtsProvider,
  VocabCard,
} from './types';
import {
  createPersonalDeck,
  DEFAULT_CUSTOM_DECK_ID,
  LEARNING_PHASES,
  STARTER_CARDS,
  STARTER_DECKS,
} from './data';
import {
  createInitialAppState,
  loadAppState,
  saveAppState,
} from './storage/state';
import {
  buildDailyQueue,
  calculateProgressStats,
  grantExtraNewCards,
  undoCardReview,
  type UndoSnapshot,
} from './srs/engine';
import {
  checkServerTtsStatus,
  isElevenLabsConfigured,
  loadElevenLabsApiKey,
  type ServerTtsStatus,
} from './speech/elevenlabs';
import { AppHeader } from './components/AppHeader';
import { TodayView } from './components/TodayView';
import { DecksView } from './components/DecksView';
import { AddImportView } from './components/AddImportView';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { ReviewSession } from './components/ReviewSession';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { Toast, type ToastMessage } from './components/Toast';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [inReviewSession, setInReviewSession] = useState(false);
  const [sessionInitialQueue, setSessionInitialQueue] = useState<VocabCard[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [serverTtsChecked, setServerTtsChecked] = useState(false);
  const [serverTtsStatus, setServerTtsStatus] = useState<ServerTtsStatus>({
    available: false,
    serverConfigured: false,
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const firstThemeSyncRef = useRef(true);

  useEffect(() => {
    let active = true;
    void checkServerTtsStatus().then((status) => {
      if (!active) return;
      setServerTtsStatus(status);
      setServerTtsChecked(true);
    });
    return () => {
      active = false;
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!serverTtsChecked) return;
    const ready = isElevenLabsConfigured(
      serverTtsStatus,
      state.settings.elevenLabs,
      loadElevenLabsApiKey().length > 0
    );
    if (state.settings.ttsProvider === 'elevenlabs' && !ready) {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          ttsProvider: 'browser',
        },
      }));
    }
  }, [
    serverTtsChecked,
    serverTtsStatus,
    state.settings.ttsProvider,
    state.settings.elevenLabs,
  ]);

  const notify = useCallback((tone: ToastMessage['tone'], text: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ id: String(Date.now()), tone, text });
    if (tone !== 'error') {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 3600);
    }
  }, []);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  const isDark =
    state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (!firstThemeSyncRef.current) {
      root.classList.add('theme-switching');
    }
    firstThemeSyncRef.current = false;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    void getComputedStyle(root).opacity;
    const raf = window.requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isDark]);

  useEffect(() => {
    const tabTitles: Record<NavTab, string> = {
      today: 'Hari Ini',
      decks: 'Deck',
      add: 'Tambah & Import',
      progress: 'Progres',
      settings: 'Setelan',
    };
    document.title = inReviewSession ? 'Sesi Review' : tabTitles[activeTab];
  }, [activeTab, inReviewSession]);

  const allDecks: DeckDefinition[] = useMemo(() => {
    const hasPersonalCards = state.customCards.some((c) => c.deckId === DEFAULT_CUSTOM_DECK_ID);
    const hasPersonalDeck = state.customDecks.some((d) => d.id === DEFAULT_CUSTOM_DECK_ID);
    const extraPersonal = hasPersonalCards && !hasPersonalDeck ? [createPersonalDeck()] : [];
    return [...STARTER_DECKS, ...extraPersonal, ...state.customDecks];
  }, [state.customCards, state.customDecks]);

  const allCards: VocabCard[] = useMemo(
    () => [...STARTER_CARDS, ...state.customCards],
    [state.customCards]
  );

  const activeDecks = useMemo(() => {
    const set = new Set(state.settings.activeDeckIds);
    return allDecks.filter((d) => set.has(d.id));
  }, [allDecks, state.settings.activeDeckIds]);

  const queueInfo = useMemo(
    () =>
      buildDailyQueue({
        cards: allCards,
        progress: state.progress,
        activeDeckIds: state.settings.activeDeckIds,
        dailyNewLimit: state.settings.dailyNewLimit,
        dailyActivity: state.dailyActivity,
      }),
    [
      allCards,
      state.progress,
      state.settings.activeDeckIds,
      state.settings.dailyNewLimit,
      state.dailyActivity,
    ]
  );

  const stats = useMemo(
    () =>
      calculateProgressStats({
        cards: allCards,
        progress: state.progress,
        dailyActivity: state.dailyActivity,
      }),
    [allCards, state.progress, state.dailyActivity]
  );

  const handleToggleTheme = () => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: isDark ? 'light' : 'dark',
      },
    }));
  };

  const handleChangePhase = (phaseId: LearningPhaseId) => {
    const phase = LEARNING_PHASES.find((p) => p.id === phaseId);
    if (!phase) return;

    setState((prev) => {
      const starterIdSet = new Set(STARTER_DECKS.map((d) => d.id));
      const preservedCustomActive = prev.settings.activeDeckIds.filter(
        (id) => !starterIdSet.has(id)
      );
      const nextActive = Array.from(
        new Set([...phase.recommendedDeckIds, ...preservedCustomActive])
      );

      return {
        ...prev,
        settings: {
          ...prev.settings,
          phaseId,
          activeDeckIds: nextActive,
          showIndonesianHint: phase.suggestedHintDefault,
        },
      };
    });

    notify(
      'success',
      `${phase.title} (${phase.cefrTarget}) aktif. Deck rekomendasi otomatis dipilih.`
    );
  };

  const handleChangeStudyMode = (studyMode: StudyMode) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, studyMode },
    }));
  };

  const handleToggleHint = () => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showIndonesianHint: !prev.settings.showIndonesianHint,
      },
    }));
  };

  const handleChangeAccent = (accent: SpeechAccent) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, accent },
    }));
  };

  const handleChangeSpeechRate = (speechRate: SpeechRate) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, speechRate },
    }));
  };

  const handleChangeTtsProvider = (ttsProvider: TtsProvider) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ttsProvider },
    }));
  };

  const handleChangeElevenLabs = (elevenLabs: ElevenLabsSettings) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, elevenLabs },
    }));
  };

  const handleToggleDeck = (deckId: string) => {
    setState((prev) => {
      const exists = prev.settings.activeDeckIds.includes(deckId);
      const nextIds = exists
        ? prev.settings.activeDeckIds.filter((id) => id !== deckId)
        : [...prev.settings.activeDeckIds, deckId];
      return {
        ...prev,
        settings: { ...prev.settings, activeDeckIds: nextIds },
      };
    });
  };

  const handleChangeDailyNewLimit = (dailyNewLimit: DailyNewPreset) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, dailyNewLimit },
    }));
    notify('info', `Jatah kata baru harian diatur ke ${dailyNewLimit} kartu/hari.`);
  };

  const handleStartReview = () => {
    if (queueInfo.queue.length === 0) return;
    setSessionInitialQueue(queueInfo.queue);
    setInReviewSession(true);
  };

  const handleAddExtraFromToday = () => {
    const nextState = grantExtraNewCards(state, 5, new Date());
    setState(nextState);
    const refreshed = buildDailyQueue({
      cards: allCards,
      progress: nextState.progress,
      activeDeckIds: nextState.settings.activeDeckIds,
      dailyNewLimit: nextState.settings.dailyNewLimit,
      dailyActivity: nextState.dailyActivity,
    });
    if (refreshed.queue.length > 0) {
      setSessionInitialQueue(refreshed.queue);
      setInReviewSession(true);
    }
    notify('success', '5 kartu ekstra ditambahkan ke sesi hari ini.');
  };

  const handleGrantExtraInSession = (): VocabCard[] => {
    const nextState = grantExtraNewCards(state, 5, new Date());
    setState(nextState);
    const refreshed = buildDailyQueue({
      cards: allCards,
      progress: nextState.progress,
      activeDeckIds: nextState.settings.activeDeckIds,
      dailyNewLimit: nextState.settings.dailyNewLimit,
      dailyActivity: nextState.dailyActivity,
    });
    return refreshed.queue;
  };

  const handleUndoSnapshot = (snapshot: UndoSnapshot) => {
    setState((prev) => undoCardReview(prev, snapshot));
  };

  const handleImportCards = (newCards: VocabCard[], newDeckTitle?: string) => {
    if (newCards.length === 0) return;
    const targetDeckId = newCards[0].deckId;

    setState((prev) => {
      const nextCustomDecks = [...prev.customDecks];
      if (newDeckTitle && !nextCustomDecks.some((d) => d.id === targetDeckId)) {
        nextCustomDecks.push({
          id: targetDeckId,
          title: newDeckTitle,
          subtitle: 'Deck Kustom',
          description: 'Deck kosakata yang Anda buat atau impor sendiri.',
          cefrRange: 'A2–C1',
          recommendedPhases: ['phase-1', 'phase-2', 'phase-3', 'phase-4'],
          phaseLabel: 'Kustom',
          isStarter: false,
        });
      }

      const nextActiveDeckIds = prev.settings.activeDeckIds.includes(targetDeckId)
        ? prev.settings.activeDeckIds
        : [...prev.settings.activeDeckIds, targetDeckId];

      return {
        ...prev,
        settings: {
          ...prev.settings,
          activeDeckIds: nextActiveDeckIds,
        },
        customDecks: nextCustomDecks,
        customCards: [...prev.customCards, ...newCards],
      };
    });
  };

  const handleRestoreState = (restored: AppState) => {
    setState(restored);
  };

  const handleResetProgress = () => {
    setState((prev) => ({
      ...createInitialAppState(),
      settings: {
        ...prev.settings,
      },
      customDecks: prev.customDecks,
      customCards: prev.customCards,
    }));
    notify('info', 'Progres review direset. Kartu kustom Anda tetap disimpan.');
  };

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold"
      style={{
        backgroundColor: 'var(--accent-solid)',
        color: 'var(--text-on-accent)',
      }}
    >
      Langsung ke konten utama
    </a>
  );

  const voiceModal = (
    <VoiceSettingsModal
      isOpen={isVoiceModalOpen}
      accent={state.settings.accent}
      speechRate={state.settings.speechRate}
      ttsProvider={state.settings.ttsProvider}
      elevenLabs={state.settings.elevenLabs}
      serverStatus={serverTtsStatus}
      onClose={() => setIsVoiceModalOpen(false)}
      onChangeAccent={handleChangeAccent}
      onChangeSpeechRate={handleChangeSpeechRate}
      onChangeProvider={handleChangeTtsProvider}
      onChangeElevenLabs={handleChangeElevenLabs}
      onNotify={notify}
    />
  );

  if (inReviewSession) {
    return (
      <>
        {skipLink}
        <ReviewSession
          initialQueue={sessionInitialQueue}
          state={state}
          decks={allDecks}
          streak={stats.currentStreak}
          availableExtraNewCount={queueInfo.availableExtraNewCount}
          onCommitState={setState}
          onUndoSnapshot={handleUndoSnapshot}
          onGrantExtraAndGetCards={handleGrantExtraInSession}
          onChangeStudyMode={handleChangeStudyMode}
          onToggleHint={handleToggleHint}
          onChangeAccent={handleChangeAccent}
          onChangeSpeechRate={handleChangeSpeechRate}
          onOpenVoiceSettings={() => setIsVoiceModalOpen(true)}
          serverElevenLabsConfigured={serverTtsStatus.serverConfigured}
          onExit={() => setInReviewSession(false)}
          onNotify={notify}
        />
        {voiceModal}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {skipLink}
      <AppHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        streak={stats.currentStreak}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        dueBadgeCount={queueInfo.totalCount}
        accent={state.settings.accent}
        onChangeAccent={handleChangeAccent}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pt-8 md:pb-12"
      >
        {activeTab === 'today' && (
          <TodayView
            queueInfo={queueInfo}
            phaseId={state.settings.phaseId}
            studyMode={state.settings.studyMode}
            accent={state.settings.accent}
            streak={stats.currentStreak}
            dailyNewLimit={state.settings.dailyNewLimit}
            activeDecks={activeDecks}
            onStartReview={handleStartReview}
            onAddExtraCards={handleAddExtraFromToday}
            onChangeStudyMode={handleChangeStudyMode}
            onGoToDecks={() => setActiveTab('decks')}
          />
        )}

        {activeTab === 'decks' && (
          <DecksView
            decks={allDecks}
            allCards={allCards}
            progress={state.progress}
            activeDeckIds={state.settings.activeDeckIds}
            phaseId={state.settings.phaseId}
            dailyNewLimit={state.settings.dailyNewLimit}
            accent={state.settings.accent}
            speechRate={state.settings.speechRate}
            ttsProvider={state.settings.ttsProvider}
            elevenLabs={state.settings.elevenLabs}
            onToggleDeck={handleToggleDeck}
            onChangeDailyNewLimit={handleChangeDailyNewLimit}
          />
        )}

        {activeTab === 'add' && (
          <AddImportView
            decks={allDecks}
            onImportCards={handleImportCards}
            onNotify={notify}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            state={state}
            stats={stats}
            onRestoreState={handleRestoreState}
            onResetProgress={handleResetProgress}
            onNotify={notify}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            phaseId={state.settings.phaseId}
            accent={state.settings.accent}
            speechRate={state.settings.speechRate}
            ttsProvider={state.settings.ttsProvider}
            elevenLabs={state.settings.elevenLabs}
            serverStatus={serverTtsStatus}
            onChangePhase={handleChangePhase}
            onChangeAccent={handleChangeAccent}
            onChangeSpeechRate={handleChangeSpeechRate}
            onChangeProvider={handleChangeTtsProvider}
            onChangeElevenLabs={handleChangeElevenLabs}
            onNotify={notify}
          />
        )}
      </main>

      {voiceModal}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
