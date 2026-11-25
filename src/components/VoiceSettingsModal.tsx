import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type {
  ElevenLabsSettings,
  SpeechAccent,
  SpeechRate,
  TtsProvider,
} from '../types';
import type { ServerTtsStatus } from '../speech/elevenlabs';
import { stopSpeaking } from '../speech/tts';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  accent: SpeechAccent;
  speechRate: SpeechRate;
  ttsProvider: TtsProvider;
  elevenLabs: ElevenLabsSettings;
  serverStatus: ServerTtsStatus;
  onClose: () => void;
  onChangeAccent: (accent: SpeechAccent) => void;
  onChangeSpeechRate: (rate: SpeechRate) => void;
  onChangeProvider: (provider: TtsProvider) => void;
  onChangeElevenLabs: (next: ElevenLabsSettings) => void;
  onNotify: (tone: 'success' | 'info' | 'error', text: string) => void;
}

export function VoiceSettingsModal({
  isOpen,
  accent,
  speechRate,
  ttsProvider,
  elevenLabs,
  serverStatus,
  onClose,
  onChangeAccent,
  onChangeSpeechRate,
  onChangeProvider,
  onChangeElevenLabs,
  onNotify,
}: VoiceSettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      prev?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    stopSpeaking();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby="voice-settings-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      {isOpen && (
        <div className="paper-card-elevated w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[24px] p-5 sm:p-6 space-y-5 animate-card-reveal">
          <div className="flex items-start justify-between gap-3">
            <h2 id="voice-settings-title" className="font-serif-study text-2xl font-medium leading-tight">
              Pengaturan Suara
            </h2>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Tutup pengaturan suara"
              className="flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center rounded-xl p-2 transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <VoiceSettingsPanel
            idPrefix="modal-voice"
            accent={accent}
            speechRate={speechRate}
            ttsProvider={ttsProvider}
            elevenLabs={elevenLabs}
            serverStatus={serverStatus}
            onChangeAccent={onChangeAccent}
            onChangeSpeechRate={onChangeSpeechRate}
            onChangeProvider={onChangeProvider}
            onChangeElevenLabs={onChangeElevenLabs}
            onNotify={onNotify}
          />
        </div>
      )}
    </dialog>
  );
}
