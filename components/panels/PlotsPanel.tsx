'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { CamberPlot, BumpSteerPlot, RollCenterPlot, MotionRatioPlot } from '@/components/plots/KinematicPlots';
import { cn } from '@/lib/utils';

type PlotTab = 'camber' | 'bumpsteer' | 'rollcenter' | 'motionratio';

const TABS: Array<{ id: PlotTab; label: string }> = [
  { id: 'camber',      label: 'Camber' },
  { id: 'bumpsteer',   label: 'Bump Steer' },
  { id: 'rollcenter',  label: 'Roll Center' },
  { id: 'motionratio', label: 'Motion Ratio' },
];

export function PlotsPanel() {
  const { frontSweep, rearSweep } = useProjectStore();
  const [activeTab, setActiveTab] = useState<PlotTab>('camber');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2 text-xs whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'text-brand border-b-2 border-brand'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plot area */}
      <div className="flex-1 min-h-0 p-2">
        {(!frontSweep && !rearSweep) ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Run a sweep to see plots
          </div>
        ) : (
          <div className="h-full">
            {activeTab === 'camber'      && <CamberPlot      frontSweep={frontSweep} rearSweep={rearSweep} />}
            {activeTab === 'bumpsteer'   && <BumpSteerPlot   frontSweep={frontSweep} rearSweep={rearSweep} />}
            {activeTab === 'rollcenter'  && <RollCenterPlot  frontSweep={frontSweep} rearSweep={rearSweep} />}
            {activeTab === 'motionratio' && <MotionRatioPlot frontSweep={frontSweep} rearSweep={rearSweep} />}
          </div>
        )}
      </div>
    </div>
  );
}
