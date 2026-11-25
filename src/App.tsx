import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState,
  DailyNewPreset,
  DeckDefinition,
  ElevenLabsSettings,
  LearningPhaseId,
  NavTab,
  SettingsSectionId,
  SpeechAccent,
  SpeechRate,
  ReviewRatingKey,
  StudyStage,
  ThemePreference,
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
  getLocalDateKey,
  loadAppState,
  saveAppState,
} from './storage/state';
import {
  calculateProgressStats,
  grantExtraNewCards,
} from './srs/engine';
import { completeListening, completeStudyAnswer, getDailyStudy, markStageFinished } from './srs/dailyStudy';
import {
  checkServerTtsStatus,
  isElevenLabsConfigured,
  loadElevenLabsApiKey,
  type ServerTtsStatus,
} from './speech/elevenlabs';
import { stopSpeaking } from './speech/tts';
import { AppHeader } from './components/AppHeader';
import { TodayView } from './components/TodayView';
import { ProgressView } from './components/ProgressView';
import { SettingsView } from './components/SettingsView';
import { ReviewSession } from './components/ReviewSession';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { Toast, type ToastMessage } from './components/Toast';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('learning');
  const [session, setSession] = useState<{ stage: StudyStage; dateKey: string; readOnly: boolean } | null>(null);
  const [studyClock, setStudyClock] = useState(() => new Date());
  const dateKey = getLocalDateKey(studyClock);
  const currentSession = session?.dateKey === dateKey ? session : null;
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
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
    });
    return () => {
      active = false;
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!serverTtsStatus.available) return;
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

  useEffect(() => {
    const refreshClock = () => setStudyClock(new Date());
    const timer = window.setInterval(refreshClock, 60_000);
    window.addEventListener('focus', refreshClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshClock);
    };
  }, []);

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
      progress: 'Progres',
      settings: 'Setelan',
    };
    document.title = currentSession
      ? (currentSession.stage === 'listening' ? 'Listening' : 'Tebak Kata')
      : tabTitles[activeTab];
  }, [activeTab, currentSession]);

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

  const study = useMemo(() => getDailyStudy(state, allCards, studyClock), [state, allCards, studyClock]);

  const stats = useMemo(
    () =>
      calculateProgressStats({
        cards: allCards,
        progress: state.progress,
        dailyActivity: state.dailyActivity,
        now: studyClock,
      }),
    [allCards, state.progress, state.dailyActivity, studyClock]
  );

  const handleChangeTheme = (theme: ThemePreference) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme,
      },
    }));
  };

  const handleOpenSettingsSection = (section: SettingsSectionId) => {
    setSettingsSection(section);
    setActiveTab('settings');
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

  const handleStartStudy = (extra = false) => {
    const now = new Date();
    const current = getDailyStudy(state, allCards, now);
    const canAddExtra =
      extra &&
      (current.clozeCards.length === 0 || current.clozeFinished) &&
      current.extraCount > 0;
    const base = canAddExtra
      ? grantExtraNewCards(state, current.extraCount, now)
      : state;
    const next = base === state ? current : getDailyStudy(base, allCards, now);
    setStudyClock(now);
    const needsListening = next.listeningCards.length > 0 && !next.listeningFinished;
    const needsCloze = next.clozeCards.length > 0 && !next.clozeFinished;
    if (!needsListening && !needsCloze) return;
    setState({ ...base, dailyStudy: next.plan });
    setSession({
      dateKey: next.plan.dateKey,
      stage: needsListening ? 'listening' : 'cloze',
      readOnly: false,
    });
  };

  const handleStartStage = (stage: StudyStage) => {
    const now = new Date();
    const current = getDailyStudy(state, allCards, now);
    setStudyClock(now);
    if (stage === 'listening') {
      if (current.listeningCards.length === 0) return;
      setState((prev) => ({ ...prev, dailyStudy: current.plan }));
      setSession({
        dateKey: current.plan.dateKey,
        stage: 'listening',
        readOnly: current.listeningFinished,
      });
      return;
    }
    if (
      (current.listeningCards.length > 0 && !current.listeningFinished) ||
      current.clozeCards.length === 0
    ) {
      return;
    }
    setState((prev) => ({ ...prev, dailyStudy: current.plan }));
    setSession({
      dateKey: current.plan.dateKey,
      stage: 'cloze',
      readOnly: current.clozeFinished,
    });
  };

  const handleExitStudy = useCallback(() => {
    stopSpeaking();
    setStudyClock(new Date());
    setSession(null);
    setIsVoiceModalOpen(false);
    requestAnimationFrame(() => document.getElementById('today-title')?.focus());
  }, []);

  useEffect(() => {
    if (session && session.dateKey !== dateKey) {
      handleExitStudy();
    }
  }, [session, dateKey, handleExitStudy]);

  const handleRating = (card: VocabCard, rating: ReviewRatingKey) => {
    const now = new Date();
    if (getLocalDateKey(now) !== dateKey) {
      handleExitStudy();
      return false;
    }
    const result = currentSession?.stage === 'listening'
      ? { nextState: completeListening(state, dateKey, card.id, rating) }
      : completeStudyAnswer(state, dateKey, card, rating, now);
    if (!result) return false;
    if (result.nextState !== state) {
      setState(result.nextState);
    }
    return true;
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

  if (currentSession) {
    return (
      <>
        {skipLink}
        <ReviewSession
          key={`${currentSession.dateKey}-${currentSession.stage}-${currentSession.readOnly ? 'ro' : 'active'}`}
          stage={currentSession.stage}
          study={study}
          readOnly={currentSession.readOnly}
          settings={state.settings}
          decks={allDecks}
          onRate={handleRating}
          onContinueToCloze={
            currentSession.stage === 'listening' && study.clozeCards.length > 0 && !study.clozeFinished
              ? () => setSession({ dateKey: currentSession.dateKey, stage: 'cloze', readOnly: false })
              : undefined
          }
          onFinishStage={() => {
            const totalCards =
              currentSession.stage === 'listening'
                ? study.listeningCards.length
                : study.clozeCards.length;
            setState((prev) => markStageFinished(prev, dateKey, currentSession.stage, totalCards));
          }}
          onOpenVoiceSettings={() => setIsVoiceModalOpen(true)}
          onExit={handleExitStudy}
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
        dueBadgeCount={study.cloze.length}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 sm:px-6 md:pt-8 md:pb-12"
      >
        {activeTab === 'today' && (
          <TodayView
            study={study}
            phaseId={state.settings.phaseId}
            accent={state.settings.accent}
            activeDecks={activeDecks}
            onStart={() => handleStartStudy()}
            onStartStage={handleStartStage}
            onAddExtra={() => handleStartStudy(true)}
            onGoToDecks={() => handleOpenSettingsSection('decks')}
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
            activeSection={settingsSection}
            onSelectSection={setSettingsSection}
            phaseId={state.settings.phaseId}
            dailyNewLimit={state.settings.dailyNewLimit}
            theme={state.settings.theme}
            accent={state.settings.accent}
            speechRate={state.settings.speechRate}
            ttsProvider={state.settings.ttsProvider}
            elevenLabs={state.settings.elevenLabs}
            serverStatus={serverTtsStatus}
            decks={allDecks}
            allCards={allCards}
            progress={state.progress}
            activeDeckIds={state.settings.activeDeckIds}
            onChangePhase={handleChangePhase}
            onChangeDailyNewLimit={handleChangeDailyNewLimit}
            onChangeTheme={handleChangeTheme}
            onChangeAccent={handleChangeAccent}
            onChangeSpeechRate={handleChangeSpeechRate}
            onChangeProvider={handleChangeTtsProvider}
            onChangeElevenLabs={handleChangeElevenLabs}
            onToggleDeck={handleToggleDeck}
            onImportCards={handleImportCards}
            onNotify={notify}
          />
        )}
      </main>

      {voiceModal}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
