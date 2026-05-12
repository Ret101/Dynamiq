'use client';

import { useUIStore, type ViewerMode } from '@/store/uiStore';
import { cn } from '@/lib/utils';

const VIEW_MODES: Array<{ id: ViewerMode; label: string }> = [
  { id: '3d',   label: '3D'    },
  { id: 'front', label: 'Front' },
  { id: 'side',  label: 'Side'  },
  { id: 'top',   label: 'Top'   },
];

const VISIBILITY_KEYS = [
  { key: 'showArmLines' as const,        label: 'Arms'   },
  { key: 'showInstantCenters' as const,  label: 'IC'     },
  { key: 'showRollCenter' as const,      label: 'RC'     },
  { key: 'showWheels' as const,          label: 'Wheels' },
  { key: 'showContactPatches' as const,  label: 'Patches' },
  { key: 'showGround' as const,          label: 'Ground' },
];

export function ViewerControls() {
  const { viewerMode, setViewerMode, toggleVisibility, ...state } = useUIStore();

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-2/90 backdrop-blur border border-border/60 rounded-lg px-3 py-1.5">
      {/* View mode */}
      <div className="flex gap-0.5">
        {VIEW_MODES.map(v => (
          <button
            key={v.id}
            onClick={() => setViewerMode(v.id)}
            className={cn(
              'px-2 py-0.5 text-xs rounded transition-colors',
              viewerMode === v.id
                ? 'bg-brand text-black font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Visibility toggles */}
      <div className="flex gap-0.5">
        {VISIBILITY_KEYS.map(({ key, label }) => {
          const isOn = (state as Record<string, unknown>)[key] as boolean;
          return (
            <button
              key={key}
              onClick={() => toggleVisibility(key)}
              className={cn(
                'px-2 py-0.5 text-xs rounded transition-colors',
                isOn
                  ? 'text-brand'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
