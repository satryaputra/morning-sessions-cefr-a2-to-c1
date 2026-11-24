import {
  Sun,
  Moon,
  Flame,
  Sunrise,
  Layers,
  PlusCircle,
  BarChart3,
} from 'lucide-react';
import type { NavTab } from '../types';

interface AppHeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  streak: number;
  isDark: boolean;
  onToggleTheme: () => void;
  dueBadgeCount: number;
}

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof Sunrise }> = [
  { id: 'today', label: 'Hari Ini', icon: Sunrise },
  { id: 'decks', label: 'Deck', icon: Layers },
  { id: 'add', label: 'Tambah', icon: PlusCircle },
  { id: 'progress', label: 'Progres', icon: BarChart3 },
];

export function AppHeader({
  activeTab,
  onSelectTab,
  streak,
  isDark,
  onToggleTheme,
  dueBadgeCount,
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
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('today')}
            className="flex items-center gap-2.5 rounded-xl py-1 pr-2 text-left transition-opacity hover:opacity-85"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shadow-xs"
              style={{
                backgroundColor: 'var(--accent-solid)',
                color: 'var(--text-on-accent)',
              }}
              aria-hidden="true"
            >
              PK
            </span>
            <div>
              <div className="text-[15px] font-bold tracking-tight leading-none">PagiKata</div>
              <div
                className="mt-0.5 text-[11px] font-medium leading-none"
                style={{ color: 'var(--text-muted)' }}
              >
                Kosakata Pagi • A2→C1
              </div>
            </div>
          </button>

          {/* Desktop 4-Menu Navigation */}
          <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-1 rounded-2xl p-1" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all"
                  style={{
                    backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 1px 3px oklch(0 0 0 / 0.08)' : 'none',
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={isActive ? 2.1 : 1.75} />
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

          {/* Right controls: Streak + Theme */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums"
              style={{
                backgroundColor: 'var(--sun-soft)',
                color: 'var(--sun-text)',
                border: '1px solid var(--sun-border)',
              }}
              title="Streak harian Anda"
            >
              <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>{streak} hari</span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--bg-subtle)]"
              style={{
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
              }}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Thumb-friendly 4 main menus) */}
      <nav
        aria-label="Navigasi mobile"
        className="fixed bottom-0 inset-x-0 z-30 md:hidden backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in oklab, var(--bg-surface) 94%, transparent)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="grid grid-cols-4 px-2 py-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors"
                style={{
                  color: isActive ? 'var(--accent-text)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.75} />
                  {item.id === 'today' && dueBadgeCount > 0 && !isActive && (
                    <span
                      className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
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
