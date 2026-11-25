# Latihan Kosakata (A2 hingga C1)

Web app (PWA) latihan kosakata bahasa Inggris berbasis **Spaced Repetition System (`ts-fsrs`)** yang tenang, ringan, dan siap dipakai di desktop maupun ponsel. Dirancang untuk sesi review harian singkat (sekitar 10 hingga 15 menit per hari) dari tingkat A2 menuju C1.

## Fitur Utama

- **Dua Sesi Berurutan di Hari Ini**:
  1. **Listening**: Dengarkan audio kalimat (dukungan aksen US/UK melalui suara browser atau ElevenLabs dengan cache lokal). Di Mode Fondasi transkrip rumpang langsung terlihat, sedangkan di mode lain transkrip dibuka setelah menyimak. Setelah kata terbuka, tersedia arti, IPA, pemutar audio kata, dan terjemahan kalimat.
  2. **Tebak Kata**: Melanjutkan kata dari sesi Listening dalam kalimat konteks yang berbeda tanpa mengetik jawaban, lalu diikuti kartu terjadwal yang sudah jatuh tempo. Gunakan **Minta petunjuk** untuk melihat huruf awal dan arti singkat, atau **Lihat jawaban** untuk membuka kata target.
- **Penilaian Mandiri Tanpa Ketikan**:
  - Nilai diri di setiap kartu menggunakan empat tombol: **Baru** (`1`), **Susah** (`2`), **Biasa** (`3`), dan **Mudah** (`4`).
  - Kartu yang sudah dinilai dapat diubah nilainya selama sesi masih berlangsung (selama bukan kartu lama dengan data riwayat tidak lengkap).
  - Navigasi antar kartu memakai **Sebelumnya** dan **Lanjut**, dengan gerbang **Selesai Listening** dan **Selesai Tebak Kata** di kartu terakhir agar progres sesi tersimpan utuh.
  - Sesi yang sudah selesai tetap dapat dibuka kembali dalam mode **Lihat ulang** (read-only), dan Anda bisa menambah 5 kata baru ekstra setelah latihan hari ini selesai. Tekan `Esc` kapan saja untuk kembali ke **Hari Ini**.
- **200 Kartu Bawaan (4 Deck Terkurasi)**:
  1. **Kosakata Fondasi (A2-B1)** - 50 kartu
  2. **Kosakata Menengah (B1-B2)** - 50 kartu
  3. **Idiom & Percakapan (B1-B2)** - 50 kartu
  4. **Kosakata Mahir C1 (B2-C1)** - 50 kartu
- **Setelan Terstruktur**:
  - **Preferensi**: *Belajar & Tampilan* (mode belajar, jatah kata baru harian 5/10/15, tema Terang/Gelap/Ikuti Sistem) dan *Aksen & Suara* (aksen US/UK, kecepatan bicara, pilihan suara browser atau ElevenLabs).
  - **Koleksi Kata**: *Deck Kosakata* untuk mengaktifkan deck dan *Tambah & Import* untuk membuat kartu kustom atau mengimpor CSV/TSV (termasuk kolom opsional `practiceSentence` dan `sentenceTranslationId`).
- **Progres & Backup JSON**:
  - Streak harian, kalender aktivitas 28 hari dengan rincian penilaian sesi Listening dan Tebak Kata per tanggal, status penguasaan kartu, progres per level CEFR (`A2` hingga `C1`), serta Export/Import Backup JSON.

## Cara Menjalankan

```bash
pnpm install
pnpm dev
```

### Mengaktifkan Suara ElevenLabs (Opsional)

1. Salin `.env.example` menjadi `.env.local` dan isi `ELEVENLABS_API_KEY` dari akun ElevenLabs Anda. Proxy lokal Vite (`/api/tts/elevenlabs`) menyambungkannya secara aman di `pnpm dev` maupun `pnpm preview`.
2. Atau buka **Atur suara** saat sesi berlangsung (atau menu **Setelan** bagian **Aksen & Suara**), pilih **ElevenLabs**, masukkan API key lokal jika tidak memakai proxy server, lalu pilih voice UK/US dan model (`Flash v2.5` atau `Multilingual v2`). Klip audio yang sudah diputar disimpan di cache browser lokal dan otomatis beralih ke suara browser bila offline.

## Perintah Pengembangan & Pengujian

```bash
pnpm run typecheck   # Cek TypeScript
pnpm test            # Jalankan unit test Vitest
pnpm run build       # Build produksi (dist/)
pnpm run preview     # Preview hasil build produksi
```
