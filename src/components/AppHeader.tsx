import {
  Sun,
  Moon,
  Flame,
  Sunrise,
  Layers,
  PlusCircle,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { NavTab, SpeechAccent } from '../types';

interface AppHeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  streak: number;
  isDark: boolean;
  onToggleTheme: () => void;
  dueBadgeCount: number;
  accent: SpeechAccent;
  onChangeAccent: (accent: SpeechAccent) => void;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Sunrise }> = [
  { id: 'today', label: 'Hari Ini', icon: Sunrise },
  { id: 'decks', label: 'Deck', icon: Layers },
  { id: 'add', label: 'Tambah', icon: PlusCircle },
  { id: 'progress', label: 'Progres', icon: BarChart3 },
  { id: 'settings', label: 'Setelan', icon: Settings },
];

export function AppHeader({
  activeTab,
  onSelectTab,
  streak,
  isDark,
  onToggleTheme,
  dueBadgeCount,
  accent,
  onChangeAccent,
}: AppHeaderProps) {
  return (
    <>
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--bg-canvas) 88%, transparent)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="mx-auto flex min-h-16 max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6">
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex flex-wrap items-center gap-0.5 lg:gap-1 rounded-2xl p-1"
            style={{ backgroundColor: 'var(--bg-subtle)' }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 lg:px-3 py-2 text-xs lg:text-sm font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.1 : 1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.id === 'today' && dueBadgeCount > 0 && !isActive && (
                    <span
                      className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      {dueBadgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-1 md:flex-initial items-center justify-between md:justify-end gap-1.5 sm:gap-2">
            <div
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold tabular-nums whitespace-nowrap"
              style={{
                backgroundColor: 'var(--sun-soft)',
                color: 'var(--sun-text)',
                border: '1px solid var(--sun-border)',
              }}
              title="Streak harian Anda"
            >
              <Flame className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span>{streak} hari</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div
                role="group"
                aria-label="Pilih aksen pelafalan"
                className="inline-flex shrink-0 items-center rounded-xl p-0.5"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {(['en-US', 'en-GB'] as const).map((code) => {
                  const selected = accent === code;
                  const label = code === 'en-US' ? 'US' : 'UK';
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={selected}
                      aria-label={
                        code === 'en-US' ? 'Gunakan aksen American (US)' : 'Gunakan aksen British (UK)'
                      }
                      onClick={() => onChangeAccent(code)}
                      className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-9 items-center justify-center rounded-[10px] px-2 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: selected ? 'var(--bg-surface)' : 'transparent',
                        color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: selected ? '0 1px 2px oklch(0 0 0 / 0.08)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                className="flex min-h-11 min-w-11 sm:h-9 sm:w-9 sm:min-h-9 sm:min-w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-subtle)]"
                style={{
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }}
              >
                {isDark ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navigasi mobile"
        className="fixed bottom-0 inset-x-0 z-30 md:hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="grid grid-cols-5 px-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.75} aria-hidden="true" />
                  {item.id === 'today' && dueBadgeCount > 0 && !isActive && (
                    <span
                      className="absolute -top-1 -right-2 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums leading-none"
                      style={{
                        backgroundColor: 'var(--accent-solid)',
                        color: 'var(--text-on-accent)',
                      }}
                    >
                      {dueBadgeCount > 99 ? '99+' : dueBadgeCount}
                    </span>
                  )}
                </div>
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
