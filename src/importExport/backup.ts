import type { AppState, BackupPayload } from '../types';
import { CURRENT_SCHEMA_VERSION, normalizeAppState } from '../storage/state';

export interface ParsedBackupResult {
  ok: true;
  payload: BackupPayload;
  summary: {
    exportedAt: string;
    trackedCards: number;
    customCards: number;
    totalReviews: number;
    activeDays: number;
  };
}

export interface ParsedBackupError {
  ok: false;
  error: string;
}

export function serializeBackup(state: AppState, now: Date = new Date()): string {
  const payload: BackupPayload = {
    app: 'vocab-srs',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    state,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseBackup(jsonText: string): ParsedBackupResult | ParsedBackupError {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Format file JSON tidak valid.' };
    }

    const record = parsed as Record<string, unknown>;
    if (record.app !== 'vocab-srs' && record.app !== 'PagiKata') {
      return {
        ok: false,
        error: 'File ini bukan file backup yang dikenali.',
      };
    }

    if (typeof record.schemaVersion !== 'number' || record.schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Versi backup (v${String(record.schemaVersion)}) tidak didukung oleh aplikasi ini.`,
      };
    }

    if (typeof record.state !== 'object' || record.state === null) {
      return { ok: false, error: 'Data progres di dalam file backup tidak ditemukan.' };
    }

    const normalizedState = normalizeAppState(record.state);
    const exportedAt =
      typeof record.exportedAt === 'string' ? record.exportedAt : new Date().toISOString();

    const activeDays = Object.values(normalizedState.dailyActivity).filter((d) => d.reviews > 0).length;
    const totalReviews = Object.values(normalizedState.dailyActivity).reduce(
      (sum, d) => sum + d.reviews,
      0
    );

    return {
      ok: true,
      payload: {
        app: 'vocab-srs',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt,
        state: normalizedState,
      },
      summary: {
        exportedAt,
        trackedCards: Object.keys(normalizedState.progress).length,
        customCards: normalizedState.customCards.length,
        totalReviews,
        activeDays,
      },
    };
  } catch {
    return {
      ok: false,
      error: 'Gagal membaca JSON. Pastikan file backup tidak rusak atau terpotong.',
    };
  }
}

export function triggerJsonDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
