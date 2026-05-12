'use client';

import { useUIStore, type Panel } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import type { AppMode } from '@/store/uiStore';

interface NavItem {
  id: Panel;
  icon: string;
  label: string;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'project',       icon: '⊞', label: 'Project',       shortcut: 'J' },
  { id: 'hardpoints',    icon: '⬡', label: 'Hardpoints',    shortcut: 'H' },
  { id: 'kinematics',    icon: '⟳', label: 'Kinematics',    shortcut: 'K' },
  { id: 'plots',         icon: '↗', label: 'Plots',         shortcut: 'P' },
  { id: 'tire',          icon: '◎', label: 'Tire Model',    shortcut: 'T' },
  { id: 'spring_damper', icon: '⫿', label: 'Spring/Damper', shortcut: 'D' },
  { id: 'load_transfer', icon: '⤢', label: 'Load Transfer', shortcut: 'L' },
  { id: 'optimization',  icon: '◈', label: 'Optimization',  shortcut: 'O' },
  { id: 'steering',      icon: '⊙', label: 'Steering',      shortcut: 'S' },
  { id: 'export',        icon: '⊡', label: 'Export',        shortcut: 'E' },
];

export function Sidebar() {
  const { activePanel, setActivePanel, appMode, setAppMode } = useUIStore();

  return (
    <aside className="w-44 bg-surface-1 border-r border-border flex flex-col py-2 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-3 mt-1 shrink-0">
        <img
          src="/Dynamiq/logo.png"
          alt="Dynamiq"
          className="w-7 h-7 rounded object-contain bg-white p-0.5 shrink-0"
        />
        <div className="flex flex-col leading-none">
          <span className="text-xs font-semibold text-foreground tracking-wide">Dynamiq</span>
          <span className="text-2xs text-muted-foreground/60 mt-0.5">Vehicle Engineering</span>
        </div>
      </div>

      {/* Mode tabs — 2×2 grid */}
      <div className="px-1.5 mb-2 shrink-0">
        <div className="grid grid-cols-2 rounded-md overflow-hidden border border-border bg-surface-2">
          <ModeTab label="Suspension" active={appMode === 'suspension'} onClick={() => setAppMode('suspension')} />
          <ModeTab label="CVT Calc"   active={appMode === 'cvt'}        onClick={() => setAppMode('cvt')} />
          <ModeTab label="Gearbox"    active={appMode === 'gearbox'}    onClick={() => setAppMode('gearbox')} borderTop />
          <ModeTab label="Parts Ref"  active={appMode === 'reference'}  onClick={() => setAppMode('reference')} borderTop />
        </div>
      </div>

      {/* Nav items — only show for suspension mode */}
      {appMode === 'suspension' && (
        <nav className="flex flex-col gap-0.5 px-1.5 flex-1 overflow-y-auto min-h-0">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              title={`${item.label} — press ${item.shortcut}`}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-all text-left w-full group',
                activePanel === item.id
                  ? 'bg-brand/15 text-brand border border-brand/25 shadow-sm'
                  : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground border border-transparent'
              )}
            >
              <span className={cn(
                'text-sm w-4 text-center shrink-0 transition-colors',
                activePanel === item.id ? 'text-brand' : 'text-muted-foreground/70 group-hover:text-foreground'
              )}>
                {item.icon}
              </span>
              <span className="flex-1 font-medium truncate">{item.label}</span>
              <kbd className={cn(
                'text-2xs font-mono rounded px-1 py-0 border transition-colors shrink-0',
                activePanel === item.id
                  ? 'text-brand/70 border-brand/20 bg-brand/5'
                  : 'text-muted-foreground/40 border-border/40'
              )}>
                {item.shortcut}
              </kbd>
            </button>
          ))}
        </nav>
      )}

      {appMode === 'cvt' && (
        <div className="flex-1 px-2 py-1">
          <p className="text-2xs text-muted-foreground/60 leading-relaxed">
            CVT Calculator — model belt CVT performance including ratio sweep, tractive force, max speed, and gradeability.
          </p>
        </div>
      )}
      {appMode === 'gearbox' && (
        <div className="flex-1 px-2 py-1">
          <p className="text-2xs text-muted-foreground/60 leading-relaxed">
            Gearbox Calculator — model multi-speed gearbox tractive force, acceleration, shift points, and top speed for any vehicle.
          </p>
        </div>
      )}
      {appMode === 'reference' && (
        <div className="flex-1 px-2 py-1">
          <p className="text-2xs text-muted-foreground/60 leading-relaxed">
            Parts Reference — complete FSAE and Baja SAE component library with specs, materials, functions, and rule references.
          </p>
        </div>
      )}

      {/* Bottom */}
      <div className="px-1.5 mt-2 shrink-0">
        <div className="h-px bg-border/50 mb-2" />
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ModeTab({ label, active, onClick, borderTop }: { label: string; active: boolean; onClick: () => void; borderTop?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'py-1.5 text-2xs font-medium transition-colors leading-tight text-center',
        borderTop && 'border-t border-border',
        active
          ? 'bg-brand text-black'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useUIStore();
  return (
    <button
      onClick={toggleDarkMode}
      title="Toggle theme"
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs w-full text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors border border-transparent"
    >
      <span className="text-sm w-4 text-center shrink-0">{darkMode ? '☀' : '◑'}</span>
      <span className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
