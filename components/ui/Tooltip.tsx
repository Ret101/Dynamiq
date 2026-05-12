'use client';

import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipPopupProps {
  title: string;
  body: string;
  formula?: string;
  range?: string;
  x: number;
  y: number;
}

function TooltipPopup({ title, body, formula, range, x, y }: TooltipPopupProps) {
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 280);
  const top = y;

  return createPortal(
    <div
      style={{ position: 'fixed', left, top, zIndex: 9999, width: 264, pointerEvents: 'none' }}
      className="bg-surface-1 border border-border rounded-lg shadow-xl p-3"
    >
      <div className="text-xs font-semibold text-foreground mb-1">{title}</div>
      <div className="text-2xs text-muted-foreground leading-relaxed">{body}</div>
      {formula && (
        <div className="mt-1.5 text-2xs font-mono text-brand/80 bg-surface-2 rounded px-2 py-1 leading-relaxed">
          {formula}
        </div>
      )}
      {range && (
        <div className="mt-1 text-2xs text-muted-foreground/60 italic">Typical: {range}</div>
      )}
    </div>,
    document.body
  );
}

export interface TipProps {
  title?: string;
  body: string;
  formula?: string;
  range?: string;
  className?: string;
}

/** Small ? badge that shows a tooltip popup on hover. Drop next to any label. */
export function Tip({ title, body, formula, range, className }: TipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.bottom + 6 });
    }
    setOpen(true);
  };

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          'inline-flex items-center justify-center w-3 h-3 rounded-full text-[9px] leading-none',
          'bg-surface-3 text-muted-foreground/60 hover:bg-brand/20 hover:text-brand cursor-help transition-colors shrink-0',
          className
        )}
      >
        ?
      </span>
      {open && typeof document !== 'undefined' && (
        <TooltipPopup
          title={title ?? ''}
          body={body}
          formula={formula}
          range={range}
          x={pos.x}
          y={pos.y}
        />
      )}
    </>
  );
}

/** A label row with an inline tooltip badge. */
export function FieldLabel({
  label,
  unit,
  tip,
  className,
}: {
  label: string;
  unit?: string;
  tip: TipProps;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 text-2xs text-muted-foreground mb-0.5', className)}>
      <span>{label}</span>
      {unit && <span className="text-muted-foreground/40">({unit})</span>}
      <Tip {...tip} title={tip.title ?? label} />
    </div>
  );
}

/** Labeled number input with integrated tooltip — for dense form layouts. */
export function TipInput({
  label,
  unit,
  tip,
  value,
  onChange,
  min,
  max,
  step,
  className,
}: {
  label: string;
  unit?: string;
  tip: TipProps;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <FieldLabel label={label} unit={unit} tip={tip} />
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.1}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="input-sm w-full"
      />
    </div>
  );
}

/** Section divider header used in CVT panel columns. */
export function SectionHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-2xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2 mt-1', className)}>
      {children}
    </div>
  );
}
