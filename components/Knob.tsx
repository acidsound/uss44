
import React, { useState, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  color?: string;
}

export const Knob: React.FC<KnobProps> = ({ label, value, min, max, onChange, color = 'border-retro-accent' }) => {
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);
  const knobRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Lock the pointer to this element so we get move/up events even if the finger leaves the knob
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    setDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    
    const deltaY = startYRef.current - e.clientY;
    const range = max - min;
    
    // Sensitivity: 200 pixels for full range
    const deltaValue = (deltaY / 200) * range;
    let newValue = startValueRef.current + deltaValue;
    
    // Clamp values
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const percentage = (value - min) / (max - min);
  const degrees = -135 + (percentage * 270);

  return (
    <div className="flex flex-col items-center gap-2 select-none w-20 touch-none">
      <div 
        ref={knobRef}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        className={`relative w-14 h-14 rounded-full bg-zinc-800 border-2 shadow-2xl cursor-ns-resize transition-all 
          ${dragging ? 'border-retro-accent ring-4 ring-retro-accent/20' : 'border-zinc-700 hover:border-zinc-500'}
        `}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div 
          className="absolute top-0 left-0 w-full h-full rounded-full transition-transform duration-75"
          style={{ transform: `rotate(${degrees}deg)` }}
        >
          <div className={`w-1.5 h-4 mx-auto mt-1 rounded-full shadow-[0_0_8px_rgba(255,30,86,0.6)] ${dragging ? 'bg-white' : 'bg-retro-accent'}`}></div>
        </div>
        <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-black/40 to-white/5 pointer-events-none"></div>
      </div>
      <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">{label}</span>
      <div className="bg-black/40 px-2 py-0.5 rounded border border-white/5 min-w-[50px] text-center">
        <span className="text-[11px] font-extrabold text-retro-accent glow-red">{value.toFixed(2)}</span>
      </div>
    </div>
  );
};
