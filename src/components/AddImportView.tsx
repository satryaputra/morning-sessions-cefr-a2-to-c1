import { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Highlighter,
} from 'lucide-react';
import type { CefrLevel, DeckDefinition, VocabCard } from '../types';
import { parseVocabImport, SAMPLE_CSV_TEMPLATE } from '../importExport/csvParser';
import { applyClozeMarkup, parseClozeSentence } from '../srs/cloze';
import { DEFAULT_CUSTOM_DECK_ID } from '../data';

interface AddImportViewProps {
  decks: DeckDefinition[];
  onImportCards: (cards: VocabCard[], newDeckTitle?: string) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
  embedded?: boolean;
}

const CEFR_OPTIONS: CefrLevel[] = ['A2', 'B1', 'B2', 'C1'];
const POS_OPTIONS = [
  'phrase',
  'phrasal verb',
  'collocation',
  'idiom',
  'verb',
  'noun',
  'adjective',
  'adverb',
];

export function AddImportView({
  decks,
  onImportCards,
  onNotify,
  embedded = false,
}: AddImportViewProps) {
  const [mode, setMode] = useState<'csv' | 'quick'>('csv');
  const csvTabRef = useRef<HTMLButtonElement | null>(null);
  const quickTabRef = useRef<HTMLButtonElement | null>(null);

  const [rawText, setRawText] = useState('');
  const [csvDeckId, setCsvDeckId] = useState<string>(DEFAULT_CUSTOM_DECK_ID);
  const [newDeckName, setNewDeckName] = useState('');
  const [csvDefaultCefr, setCsvDefaultCefr] = useState<CefrLevel>('B1');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [qcSentence, setQcSentence] = useState('');
  const [qcPhrase, setQcPhrase] = useState('');
  const [qcTranslation, setQcTranslation] = useState('');
  const [qcDefinition, setQcDefinition] = useState('');
  const [qcIpa, setQcIpa] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [qcCefr, setQcCefr] = useState<CefrLevel>('B2');
  const [qcPos, setQcPos] = useState('phrase');
  const [qcDeckId, setQcDeckId] = useState<string>(DEFAULT_CUSTOM_DECK_ID);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const nextMode: 'csv' | 'quick' =
        e.key === 'Home'
          ? 'csv'
          : e.key === 'End'
            ? 'quick'
            : mode === 'csv'
              ? 'quick'
              : 'csv';
      setMode(nextMode);
      (nextMode === 'csv' ? csvTabRef.current : quickTabRef.current)?.focus();
    }
  };

  const availableDecks = useMemo(() => {
    const hasPersonal = decks.some((d) => d.id === DEFAULT_CUSTOM_DECK_ID);
    if (hasPersonal) return decks;
    return [
      {
        id: DEFAULT_CUSTOM_DECK_ID,
        title: 'Koleksi Pribadi',
        subtitle: 'Kartu Tambahan & Import',
        description: '',
        cefrRange: 'A2–C1',
        recommendedPhases: ['phase-1', 'phase-2', 'phase-3', 'phase-4'] as DeckDefinition['recommendedPhases'],
        phaseLabel: 'Kustom',
        isStarter: false,
      },
      ...decks,
    ];
  }, [decks]);

  const parsedPreview = useMemo(() => {
    const targetId = csvDeckId === '__new__' ? '__new__' : csvDeckId;
    return parseVocabImport(rawText, {
      deckId: targetId,
      defaultCefr: csvDefaultCefr,
      idPrefix: 'preview',
    });
  }, [rawText, csvDeckId, csvDefaultCefr]);

  const qcParsedPreview = useMemo(() => {
    if (!qcSentence.trim()) return null;
    return parseClozeSentence(qcSentence, qcPhrase);
  }, [qcSentence, qcPhrase]);

  const handleCsvFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setRawText(content);
      onNotify('info', `File "${file.name}" dimuat. Silakan periksa preview di bawah.`);
    };
    reader.onerror = () => {
      onNotify('error', 'Gagal membaca file. Pastikan file berformat CSV atau TSV teks biasa.');
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = () => {
    const isCreatingNew = csvDeckId === '__new__';
    const trimmedDeckName = newDeckName.trim();
    if (isCreatingNew && !trimmedDeckName) {
      onNotify('error', 'Masukkan nama deck baru terlebih dahulu.');
      return;
    }

    const actualDeckId = isCreatingNew ? `custom-${Date.now()}` : csvDeckId;

    const finalParsed = parseVocabImport(rawText, {
      deckId: actualDeckId,
      defaultCefr: csvDefaultCefr,
      idPrefix: `imp-${Date.now()}`,
    });

    if (finalParsed.cards.length === 0) {
      onNotify('error', 'Belum ada kartu valid untuk diimpor.');
      return;
    }

    onImportCards(finalParsed.cards, isCreatingNew ? trimmedDeckName : undefined);
    setRawText('');
    setNewDeckName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNotify(
      'success',
      `${finalParsed.cards.length} kartu diimpor dan siap muncul di sesi review.`
    );
  };

  const handleWrapCloze = () => {
    if (!qcSentence.trim() || !qcPhrase.trim()) return;
    const wrapped = applyClozeMarkup(qcSentence, qcPhrase);
    if (wrapped === qcSentence.trim()) {
      onNotify('info', 'Frasa target belum ditemukan persis di dalam kalimat.');
      return;
    }
    setQcSentence(wrapped);
  };

  const handleSaveQuickCloze = (e: React.FormEvent) => {
    e.preventDefault();
    const sentence = qcSentence.trim();
    const parsed = parseClozeSentence(sentence, qcPhrase.trim());
    const phrase = qcPhrase.trim() || (parsed.hasMatch ? parsed.targetPhrase : '');

    if (!sentence || !phrase) {
      onNotify('error', 'Isi kalimat bahasa Inggris dan frasa target (atau tandai dengan {{frasa}}).');
      return;
    }

    const newCard: VocabCard = {
      id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deckId: qcDeckId,
      phrase,
      sentence,
      ipa: qcIpa.trim(),
      definitionEn:
        qcDefinition.trim() || `Useful English phrase from your reading/listening: "${phrase}".`,
      translationId: qcTranslation.trim() || 'Catatan pribadi',
      partOfSpeech: qcPos,
      cefr: qcCefr,
      notes: qcNotes.trim(),
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    onImportCards([newCard]);
    setQcSentence('');
    setQcPhrase('');
    setQcTranslation('');
    setQcDefinition('');
    setQcIpa('');
    setQcNotes('');
    onNotify('success', `Kartu "${phrase}" tersimpan dan langsung siap direview.`);
  };

  return (
    <div className={embedded ? 'flex flex-col gap-5 animate-card-reveal' : 'space-y-6 pb-8 animate-card-reveal'}>
      {embedded ? (
        <div className="paper-card rounded-[24px] p-5 sm:p-6">
          <h2 className="text-base font-bold">Tambah & Import Kartu</h2>
          <p className="mt-1 text-xs leading-relaxed text-pretty" style={{ color: 'var(--text-secondary)' }}>
            Tambahkan kalimat bagus dari bacaan secara cepat atau impor daftar kosakata lewat CSV/TSV.
          </p>
        </div>
      ) : (
        <section className="space-y-2">
          <h1 className="font-serif-study text-3xl font-medium tracking-[-0.015em]">
            Tambah & Import Kartu
          </h1>
          <p className="text-sm text-pretty" style={{ color: 'var(--text-secondary)' }}>
            4 deck siap pakai sudah cukup untuk rutinitas harian Anda. Fitur ini opsional: gunakan saat menemukan kalimat bagus dari bacaan atau ingin mengimpor daftar CSV/TSV.
          </p>
        </section>
      )}

      <div
        className="inline-flex self-start rounded-2xl p-1"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
        }}
        role="tablist"
        aria-label="Metode tambah kartu"
      >
        <button
          ref={csvTabRef}
          id="tab-csv"
          type="button"
          role="tab"
          aria-selected={mode === 'csv'}
          aria-controls="panel-csv"
          tabIndex={mode === 'csv' ? 0 : -1}
          onClick={() => setMode('csv')}
          onKeyDown={handleTabKeyDown}
          className="inline-flex min-h-11 sm:min-h-9 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: mode === 'csv' ? 'var(--bg-surface)' : 'transparent',
            color: mode === 'csv' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: mode === 'csv' ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
          }}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          <span>Import CSV / TSV</span>
        </button>
        <button
          ref={quickTabRef}
          id="tab-quick"
          type="button"
          role="tab"
          aria-selected={mode === 'quick'}
          aria-controls="panel-quick"
          tabIndex={mode === 'quick' ? 0 : -1}
          onClick={() => setMode('quick')}
          onKeyDown={handleTabKeyDown}
          className="inline-flex min-h-11 sm:min-h-9 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: mode === 'quick' ? 'var(--bg-surface)' : 'transparent',
            color: mode === 'quick' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: mode === 'quick' ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
          }}
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          <span>Quick Cloze (10 Detik)</span>
        </button>
      </div>

      {mode === 'csv' ? (
        <section id="panel-csv" role="tabpanel" aria-labelledby="tab-csv" className="flex flex-col gap-5">
          <div className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="csv-deck-select"
                  className="block text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Simpan ke Deck
                </label>
                <select
                  id="csv-deck-select"
                  value={csvDeckId}
                  onChange={(e) => setCsvDeckId(e.target.value)}
                  className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {availableDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                  <option value="__new__">+ Buat Deck Baru...</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="csv-cefr-select"
                  className="block text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  CEFR Default (jika kolom level kosong)
                </label>
                <select
                  id="csv-cefr-select"
                  value={csvDefaultCefr}
                  onChange={(e) => setCsvDefaultCefr(e.target.value as CefrLevel)}
                  className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {CEFR_OPTIONS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {csvDeckId === '__new__' && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="new-deck-name"
                  className="block text-xs font-semibold leading-5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Nama Deck Baru
                </label>
                <input
                  id="new-deck-name"
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="Contoh: Catatan Minggu 4"
                  className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                    onChange={(e) => handleCsvFileUpload(e.target.files?.[0])}
                    className="sr-only peer"
                    id="csv-file-upload"
                  />
                  <label
                    htmlFor="csv-file-upload"
                    className="inline-flex min-h-11 sm:min-h-9 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent-solid)]"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pilih File CSV / TSV</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_CSV_TEMPLATE)}
                  className="inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: 'var(--accent-text)' }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Isi Contoh CSV</span>
                </button>
              </div>

              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="min-h-11 sm:min-h-9 rounded-xl px-2 text-xs font-medium hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Bersihkan
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="csv-paste-input"
                className="block text-xs font-semibold leading-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Atau tempel (paste) langsung teks CSV / TSV di sini
              </label>
              <textarea
                id="csv-paste-input"
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'phrase,sentence,translation,cefr\nget the hang of,"I soon managed to get the hang of natural idioms.",mulai menguasai,B2'}
                className="w-full rounded-xl p-3.5 font-mono-code text-base sm:text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Mendukung header kolom otomatis (<code className="font-mono-code">phrase, sentence, ipa, definition, translation, partOfSpeech, cefr, notes</code>) atau format ringkas 2 kolom dengan <code className="font-mono-code">{'{{cloze}}'}</code>.
              </p>
            </div>
          </div>

          {rawText.trim().length > 0 && (
            <div className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-4 animate-card-reveal">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-bold">
                    Preview Otomatis ({parsedPreview.cards.length} kartu siap impor)
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Format terdeteksi:{' '}
                    <strong>
                      {parsedPreview.delimiter === '\t'
                        ? 'TSV (Tab)'
                        : parsedPreview.delimiter === ';'
                          ? 'CSV (Titik koma)'
                          : 'CSV (Koma)'}
                    </strong>
                    , {parsedPreview.hasHeader ? 'dengan baris header' : 'tanpa header'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmCsvImport}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-95"
                  style={{
                    backgroundColor: 'var(--accent-solid)',
                    color: 'var(--text-on-accent)',
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Import {parsedPreview.cards.length} Kartu</span>
                </button>
              </div>

              {parsedPreview.warnings.length > 0 && (
                <div
                  className="rounded-xl p-3.5 space-y-1 text-xs"
                  style={{
                    backgroundColor: 'var(--rate-hard-bg)',
                    border: '1px solid var(--rate-hard-border)',
                    color: 'var(--rate-hard-text)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Catatan parsing ({parsedPreview.warnings.length}):</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {parsedPreview.warnings.slice(0, 4).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedPreview.cards.length > 0 && (
                <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-subtle)' }}>
                  <table className="w-full text-left text-xs">
                    <thead style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">Frasa</th>
                        <th className="px-3.5 py-2.5 font-semibold">Kalimat Konteks</th>
                        <th className="px-3.5 py-2.5 font-semibold">Arti (ID)</th>
                        <th className="px-3.5 py-2.5 font-semibold">CEFR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPreview.cards.slice(0, 8).map((card) => (
                        <tr
                          key={card.id}
                          style={{ borderTop: '1px solid var(--border-subtle)' }}
                        >
                          <td className="px-3.5 py-2.5 font-semibold whitespace-nowrap align-top">{card.phrase}</td>
                          <td className="px-3.5 py-2.5 min-w-[16rem] max-w-sm whitespace-normal leading-relaxed align-top">
                            {card.sentence}
                          </td>
                          <td className="px-3.5 py-2.5 align-top" style={{ color: 'var(--text-secondary)' }}>
                            {card.translationId}
                          </td>
                          <td className="px-3.5 py-2.5 align-top">
                            <span
                              className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                            >
                              {card.cefr}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <form
          id="panel-quick"
          role="tabpanel"
          aria-labelledby="tab-quick"
          onSubmit={handleSaveQuickCloze}
          className="paper-card rounded-[24px] p-5 sm:p-6 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="qc-sentence"
              className="block text-xs font-semibold leading-5"
              style={{ color: 'var(--text-secondary)' }}
            >
              1. Tempel kalimat bahasa Inggris dari bacaan atau podcast
            </label>
            <textarea
              id="qc-sentence"
              rows={3}
              required
              value={qcSentence}
              onChange={(e) => setQcSentence(e.target.value)}
              placeholder='Contoh: Regular reading helps you pick up natural expressions without stress.'
              className="w-full rounded-xl p-3.5 text-base sm:text-sm leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="qc-phrase"
                className="block text-xs font-semibold leading-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                2. Frasa target yang ingin dikosongkan
              </label>
              <div className="flex gap-2">
                <input
                  id="qc-phrase"
                  type="text"
                  required
                  value={qcPhrase}
                  onChange={(e) => setQcPhrase(e.target.value)}
                  placeholder="Contoh: pick up"
                  className="flex-1 min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleWrapCloze}
                  aria-label="Tandai frasa sebagai cloze"
                  title="Tandai frasa di dalam kalimat dengan {{...}}"
                  className="inline-flex min-h-11 sm:min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Tandai</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="qc-translation"
                className="block text-xs font-semibold leading-5"
                style={{ color: 'var(--text-secondary)' }}
              >
                3. Arti Indonesia ringkas (petunjuk)
              </label>
              <input
                id="qc-translation"
                type="text"
                value={qcTranslation}
                onChange={(e) => setQcTranslation(e.target.value)}
                placeholder="Contoh: menyerap / mempelajari secara alami"
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {qcParsedPreview && (
            <div
              className="rounded-xl p-4 flex flex-col gap-1.5"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px dashed var(--border-strong)',
              }}
            >
              <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Preview tampilan sisi depan kartu
              </div>
              <p lang="en" className="font-serif-study text-lg leading-relaxed">
                {qcParsedPreview.segments.map((seg, idx) =>
                  seg.type === 'cloze' ? (
                    <span
                      key={idx}
                      className="mx-1 inline-block rounded-lg px-2.5 py-0.5 font-sans text-sm font-semibold"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                        borderBottom: '2px dashed var(--accent-solid)',
                      }}
                    >
                      _____
                    </span>
                  ) : (
                    <span key={idx}>{seg.value}</span>
                  )
                )}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="qc-deck" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Deck Tujuan
              </label>
              <select
                id="qc-deck"
                value={qcDeckId}
                onChange={(e) => setQcDeckId(e.target.value)}
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {availableDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="qc-cefr" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Level CEFR
              </label>
              <select
                id="qc-cefr"
                value={qcCefr}
                onChange={(e) => setQcCefr(e.target.value as CefrLevel)}
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {CEFR_OPTIONS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="qc-pos" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Kelas Kata
              </label>
              <select
                id="qc-pos"
                value={qcPos}
                onChange={(e) => setQcPos(e.target.value)}
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                {POS_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="qc-def" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Definisi English (opsional)
              </label>
              <input
                id="qc-def"
                type="text"
                value={qcDefinition}
                onChange={(e) => setQcDefinition(e.target.value)}
                placeholder="to learn informally through practice"
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="qc-ipa" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Fonetik IPA (opsional)
              </label>
              <input
                id="qc-ipa"
                type="text"
                value={qcIpa}
                onChange={(e) => setQcIpa(e.target.value)}
                placeholder="/pɪk ʌp/"
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 font-mono-code text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="qc-notes" className="block text-xs font-semibold leading-5" style={{ color: 'var(--text-secondary)' }}>
                Catatan / Sumber (opsional)
              </label>
              <input
                id="qc-notes"
                type="text"
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="Podcast atau bacaan"
                className="w-full min-h-11 sm:min-h-10 rounded-xl px-3.5 py-2 text-base sm:text-sm"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex min-h-11 w-full sm:w-auto sm:self-start items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-opacity hover:opacity-95"
            style={{
              backgroundColor: 'var(--accent-solid)',
              color: 'var(--text-on-accent)',
            }}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            <span>Simpan Kartu Cloze</span>
          </button>
        </form>
      )}
    </div>
  );
}
