import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'error';
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const isError = toast?.tone === 'error';
  const Icon =
    toast?.tone === 'success' ? CheckCircle2 : isError ? AlertCircle : Info;

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {toast && !isError ? toast.text : ''}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {toast && isError ? toast.text : ''}
      </div>
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-card-reveal">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            <Icon
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
              style={{
                color: isError
                  ? 'var(--rate-again-text)'
                  : toast.tone === 'success'
                    ? 'var(--accent-text)'
                    : 'var(--sun-text)',
              }}
            />
            <span className="flex-1 text-pretty">{toast.text}</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Tutup notifikasi"
              className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
