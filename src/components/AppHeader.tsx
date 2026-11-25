import { Flame, Sunrise, BarChart3, Settings } from 'lucide-react';
import type { NavTab } from '../types';

interface AppHeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  streak: number;
  dueBadgeCount: number;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Sunrise }> = [
  { id: 'today', label: 'Hari Ini', icon: Sunrise },
  { id: 'progress', label: 'Progres', icon: BarChart3 },
  { id: 'settings', label: 'Setelan', icon: Settings },
];

export function AppHeader({
  activeTab,
  onSelectTab,
  streak,
  dueBadgeCount,
}: AppHeaderProps) {
  return (
    <>
      <header className="relative pt-5 sm:pt-7 pb-1">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-end md:justify-between gap-2 px-[clamp(12px,3vw,1.5rem)] min-w-0">
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex flex-wrap min-w-0 max-w-full items-center gap-1 rounded-2xl p-1.5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
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
                  className={`relative flex shrink-0 min-w-0 max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs lg:text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? '' : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                    boxShadow: isActive ? 'inset 0 0 0 1px var(--accent-border)' : 'none',
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

          <div
            className="flex shrink-0 min-w-0 max-w-full items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold tabular-nums whitespace-nowrap"
            style={{
              backgroundColor: 'var(--sun-soft)',
              color: 'var(--sun-text)',
              border: '1px solid var(--sun-border)',
              boxShadow: 'var(--shadow-card)',
            }}
            title="Streak harian Anda"
          >
            <Flame className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span>{streak} hari</span>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navigasi mobile"
        className="fixed inset-x-3 bottom-3 z-30 md:hidden rounded-2xl backdrop-blur-md"
        style={{
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundColor: 'color-mix(in oklab, var(--bg-surface) 92%, transparent)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
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
