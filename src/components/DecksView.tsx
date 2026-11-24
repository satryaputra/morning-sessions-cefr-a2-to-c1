import { useMemo, useState } from 'react';
import {
  Search,
  Volume2,
  BookOpen,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import type {
  CefrLevel,
  DailyNewPreset,
  DeckDefinition,
  ElevenLabsSettings,
  LearningPhaseId,
  SpeechAccent,
  SpeechRate,
  StoredFsrsCard,
  TtsProvider,
  VocabCard,
} from '../types';
import { classifyMastery, MASTERY_LABELS } from '../srs/engine';
import { stripClozeMarkup } from '../srs/cloze';
import { speakEnglish } from '../speech/tts';

interface DecksViewProps {
  decks: DeckDefinition[];
  allCards: VocabCard[];
  progress: Record<string, StoredFsrsCard>;
  activeDeckIds: string[];
  phaseId: LearningPhaseId;
  dailyNewLimit: DailyNewPreset;
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  onToggleDeck: (deckId: string) => void;
  onChangeDailyNewLimit: (limit: DailyNewPreset) => void;
}

const PRESETS: Array<{ value: DailyNewPreset; label: string; desc: string }> = [
  { value: 5, label: 'Ringan', desc: '5 kata baru/hari • ~5–7 menit' },
  { value: 10, label: 'Standar', desc: '10 kata baru/hari • ~10–12 menit' },
  { value: 15, label: 'Intensif', desc: '15 kata baru/hari • ~15 menit' },
];

const CEFR_FILTERS: Array<'ALL' | CefrLevel> = ['ALL', 'A2', 'B1', 'B2', 'C1'];

export function DecksView({
  decks,
  allCards,
  progress,
  activeDeckIds,
  phaseId,
  dailyNewLimit,
  accent,
  speechRate,
  ttsProvider,
  elevenLabs,
  onToggleDeck,
  onChangeDailyNewLimit,
}: DecksViewProps) {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cefrFilter, setCefrFilter] = useState<'ALL' | CefrLevel>('ALL');

  const activeSet = useMemo(() => new Set(activeDeckIds), [activeDeckIds]);

  const deckSummaries = useMemo(() => {
    const nowMs = Date.now();
    return decks.map((deck) => {
      const cards = allCards.filter((c) => c.deckId === deck.id);
      let due = 0;
      let unseen = 0;
      let mastered = 0;

      for (const card of cards) {
        const stored = progress[card.id];
        const bucket = classifyMastery(stored);
        if (bucket === 'new') {
          unseen += 1;
        } else {
          if (stored && new Date(stored.due).getTime() <= nowMs) {
            due += 1;
          }
          if (bucket === 'mastering' || bucket === 'memorized') {
            mastered += 1;
          }
        }
      }

      const started = cards.length - unseen;
      return {
        deck,
        cards,
        total: cards.length,
        due,
        unseen,
        started,
        mastered,
        isActive: activeSet.has(deck.id),
        isRecommended: deck.recommendedPhases.includes(phaseId),
      };
    });
  }, [decks, allCards, progress, activeSet, phaseId]);

  const selectedDeckSummary = useMemo(
    () => deckSummaries.find((s) => s.deck.id === selectedDeckId) ?? null,
    [deckSummaries, selectedDeckId]
  );

  const filteredPreviewCards = useMemo(() => {
    if (!selectedDeckSummary) return [];
    const q = searchQuery.trim().toLowerCase();
    return selectedDeckSummary.cards.filter((card) => {
      if (cefrFilter !== 'ALL' && card.cefr !== cefrFilter) return false;
      if (!q) return true;
      return (
        card.phrase.toLowerCase().includes(q) ||
        card.sentence.toLowerCase().includes(q) ||
        card.translationId.toLowerCase().includes(q) ||
        card.definitionEn.toLowerCase().includes(q)
      );
    });
  }, [selectedDeckSummary, searchQuery, cefrFilter]);

  return (
    <div className="space-y-6 pb-8 animate-card-reveal">
      <section>
        <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em]">
          Deck Siap Pakai
        </h1>
        <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
          Aktifkan deck yang sesuai dengan fase belajar Anda dan atur ritme kartu baru harian.
        </p>
      </section>

      {/* Daily New Card Quota — 3 Simple Anti-Anki Presets */}
      <section className="paper-card rounded-2xl p-5 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Jatah Kartu Baru Harian</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cukup pilih ritme nyaman — antrean review lama tetap otomatis dijaga agar tidak menumpuk.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const isSelected = dailyNewLimit === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChangeDailyNewLimit(preset.value)}
                aria-pressed={isSelected}
                className="flex items-start justify-between rounded-2xl p-3.5 text-left transition-all"
                style={{
                  backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                  border: isSelected
                    ? '1.5px solid var(--accent-solid)'
                    : '1.5px solid transparent',
                }}
              >
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold">{preset.label}</span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {preset.value}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {preset.desc}
                  </p>
                </div>
                {isSelected && (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: 'var(--accent-solid)',
                      color: 'var(--text-on-accent)',
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Deck Cards Grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {deckSummaries.map(({ deck, total, due, unseen, started, mastered, isActive, isRecommended }) => {
          const progressPct = total > 0 ? Math.round((started / total) * 100) : 0;
          const isOpen = selectedDeckId === deck.id;

          return (
            <article
              key={deck.id}
              className="paper-card flex flex-col justify-between rounded-2xl p-5 transition-all"
              style={{
                borderColor: isActive ? 'var(--accent-border)' : 'var(--border-subtle)',
              }}
            >
              <div className="space-y-3">
                {/* Top Badges + Switch */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {deck.cefrRange}
                    </span>
                    <span
                      className="rounded-lg px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {deck.phaseLabel}
                    </span>
                    {isRecommended && deck.isStarter && (
                      <span
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        Rekomendasi
                      </span>
                    )}
                  </div>

                  {/* Clean Accessible Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${deck.title}`}
                    onClick={() => onToggleDeck(deck.id)}
                    className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--accent-solid)' : 'var(--border-strong)',
                    }}
                  >
                    <span
                      className="inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform"
                      style={{
                        transform: isActive ? 'translateX(20px)' : 'translateX(0px)',
                      }}
                    />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-bold leading-snug">{deck.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-secondary)' }}>
                    {deck.description}
                  </p>
                </div>

                {/* Progress Bar & Counts */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    <span>
                      <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> kartu •{' '}
                      {due} jatuh tempo • {unseen} baru
                    </span>
                    <span className="font-semibold">{progressPct}% mulai</span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--bg-subtle)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: 'var(--accent-solid)',
                      }}
                    />
                  </div>
                  {mastered > 0 && (
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {mastered} kartu sudah masuk tahap Menguasai / Hafal
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span
                  className="text-xs font-semibold"
                  style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-muted)' }}
                >
                  {isActive ? 'Aktif di antrean pagi' : 'Nonaktif'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeckId(isOpen ? null : deck.id);
                    setSearchQuery('');
                    setCefrFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{isOpen ? 'Tutup Daftar' : 'Lihat Daftar Kata'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* Expandable Deck Word List Preview with Search & CEFR Filter */}
      {selectedDeckSummary && (
        <section
          aria-label={`Daftar kata ${selectedDeckSummary.deck.title}`}
          className="paper-card-elevated rounded-[24px] p-5 sm:p-6 space-y-4 animate-card-reveal"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{selectedDeckSummary.deck.title}</h2>
              <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                Menampilkan {filteredPreviewCards.length} dari {selectedDeckSummary.total} kartu
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDeckId(null)}
              aria-label="Tutup daftar kata"
              className="rounded-xl p-2 transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search + CEFR Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari frasa, kalimat, atau arti…"
                className="w-full rounded-xl py-2.5 pl-10 pr-3.5 text-base sm:text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter level CEFR">
              {CEFR_FILTERS.map((level) => {
                const active = cefrFilter === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCefrFilter(level)}
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent-solid)' : 'var(--bg-subtle)',
                      color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {level === 'ALL' ? 'Semua' : level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Card Preview List */}
          <div
            className="max-h-[460px] space-y-2.5 overflow-y-auto pr-1"
            style={{ overscrollBehavior: 'contain' }}
          >
            {filteredPreviewCards.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                Tidak ada kata yang cocok dengan pencarian atau filter CEFR tersebut.
              </div>
            ) : (
              filteredPreviewCards.map((card) => {
                const bucket = classifyMastery(progress[card.id]);
                const cleanSentence = stripClozeMarkup(card.sentence);

                return (
                  <div
                    key={card.id}
                    className="rounded-2xl p-4 transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span lang="en" className="text-sm font-bold">
                            {card.phrase}
                          </span>
                          {card.ipa && (
                            <span
                              className="font-mono-code text-xs"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {card.ipa}
                            </span>
                          )}
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            {card.cefr}
                          </span>
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {MASTERY_LABELS[bucket]}
                          </span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {card.translationId}
                        </p>
                        <p
                          lang="en"
                          className="font-serif-study text-sm leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          “{cleanSentence}”
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          void speakEnglish({
                            text: cleanSentence,
                            accent,
                            rate: speechRate,
                            provider: ttsProvider,
                            elevenLabs,
                          })
                        }
                        aria-label={`Putar pelafalan ${card.phrase}`}
                        title="Putar audio kalimat"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-hover)]"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
