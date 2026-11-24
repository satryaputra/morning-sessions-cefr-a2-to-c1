# PagiKata — Review Kosakata Pagi (A2 → C1)

Web app (PWA) review kosakata bahasa Inggris berbasis **Spaced Repetition System (`ts-fsrs`)** yang dirancang tenang, modern, dan bebas kerumitan setting teknis ala Anki. Khusus dibangun untuk mendukung **Langkah 1 (Review Kosakata Pagi, 10–15 menit/hari)** dalam rencana belajar 12 bulan **A2 → C1** dengan kurikulum **BBC Learning English**.

## Fitur Utama

- **Zero-Friction Morning Flow (`Hari Ini`)**: Ringkasan sesi pagi (kartu jatuh tempo, kartu baru, estimasi durasi) dengan satu tombol besar **Mulai Review**, pemilih fase 12 bulan (Bulan 1–3, 4–6, 7–9, 10–12) yang otomatis merekomendasikan deck, target harian, dan streak.
- **200 Kartu Siap Pakai (4 Curated Starter Decks)**:
  1. **Oxford 3000 — Fondasi (A2 → B1)** — 50 kartu
  2. **Oxford 3000 — Menengah (B1 → B2)** — 50 kartu
  3. **BBC 6 Minute English — Everyday Phrases & Idioms (B1 → B2)** — 50 kartu
  4. **Oxford 5000 — C1 Precision & Nuance (B2 → C1)** — 50 kartu
- **Sentence Mining / Cloze & Mode Listening First**:
  - Sisi depan menampilkan kalimat konteks dengan target frasa dikosongkan (`_____`), badge CEFR, kelas kata, serta petunjuk arti bahasa Indonesia yang bisa di-toggle (`H`).
  - Mode **Listening First** membacakan audio aksen British English (`en-GB`) terlebih dahulu sebelum teks muncul.
  - Sisi belakang menampilkan kalimat utuh dengan frasa disorot, transkripsi fonetik **IPA**, definisi bahasa Inggris, arti Indonesia ringkas, catatan/collocation, dan tombol audio **Web Speech API** (`en-GB` / `en-US`, `1.0x` / `0.8x`).
- **Mesin SRS Modern (`ts-fsrs`)**: 4 penilaian manusiawi (`Lupa`, `Susah`, `Ingat`, `Mudah`) dengan preview interval jadwal berikutnya, fitur **Undo (`Z`)**, serta opsi **Tambah 5 Kartu Ekstra** setelah sesi harian selesai.
- **Pintasan Keyboard Desktop & Mobile PWA**: `Space` (balik kartu), `1`–`4` (nilai ingatan), `R` (putar audio), `Z` (undo), `H` (toggle petunjuk ID), `Esc` (keluar sesi), plus manifest PWA & service worker agar mudah dipasang ke homescreen.
- **Tambah & Import Opsional**: Import file/paste **CSV / TSV** dengan deteksi delimiter & preview otomatis, serta **Quick Cloze** 10 detik.
- **Progres & Backup JSON**: Streak harian, kalender aktivitas 28 hari, breakdown penguasaan (`Baru`, `Belajar`, `Menguasai`, `Hafal`), progres per level CEFR (`A2`–`C1`), serta Export/Import Backup JSON.

## Cara Menjalankan

```bash
pnpm install
pnpm dev
```

## Perintah Pengembangan & Pengujian

```bash
pnpm run typecheck   # Cek TypeScript
pnpm test            # Jalankan unit test Vitest
pnpm run build       # Build produksi (dist/)
pnpm run preview     # Preview hasil build produksi
```
