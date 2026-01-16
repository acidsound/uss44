
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useSequencerStore } from '../stores/sequencerStore';

interface BpmModalProps {
  onClose: () => void;
}

export const BpmModal: React.FC<BpmModalProps> = ({ onClose }) => {
  const { bpm, setBpm } = useSequencerStore();
  const [localBpm, setLocalBpm] = useState(bpm);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isTapping, setIsTapping] = useState(false);

  // Dial State
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startBpmRef = useRef(0);
  const lastTapRef = useRef<number>(0);

  const PIXELS_PER_BPM = 6; // Sensitivity

  const allTicks = useMemo(() => {
    const t = [];
    for (let i = 20; i <= 300; i += 10) t.push(i);
    return t;
  }, []);

  const handleTap = (e: React.PointerEvent | React.TouchEvent) => {
    // Prevent default to avoid ghost clicks and double triggers
    if (e.cancelable) e.preventDefault();

    setIsTapping(true);
    setTimeout(() => setIsTapping(false), 50);

    const now = performance.now();

    // Reset if gap is too long (3 seconds)
    if (now - lastTapRef.current > 3000) {
      setTapTimes([now]);
      lastTapRef.current = now;
      return;
    }

    setTapTimes(prev => {
      const newTimes = [...prev, now].slice(-8); // Keep last 8 taps

      if (newTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < newTimes.length; i++) {
          intervals.push(newTimes[i] - newTimes[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.round(60000 / avgInterval);
        const clamped = Math.max(20, Math.min(300, newBpm));
        setLocalBpm(clamped);
        setBpm(clamped);
      }
      return newTimes;
    });

    lastTapRef.current = now;
  };

  const handleHalfDouble = (multiplier: number) => {
    setIsAnimating(true);
    const nextBpm = Math.max(20, Math.min(300, Math.round(localBpm * multiplier)));
    setLocalBpm(nextBpm);
    setBpm(nextBpm);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleDialStart = (clientX: number) => {
    setIsAnimating(false);
    isDraggingRef.current = true;
    startXRef.current = clientX;
    startBpmRef.current = localBpm;
  };

  const handleDialMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    const deltaPixel = startXRef.current - clientX;
    // Drag Left (positive delta) -> Ruler moves left -> Higher numbers come to center
    const deltaBpm = deltaPixel / PIXELS_PER_BPM;

    let nextBpm = startBpmRef.current + deltaBpm;
    nextBpm = Math.max(20, Math.min(300, nextBpm));

    setLocalBpm(nextBpm);
    setBpm(Math.round(nextBpm));
  };

  const handleDialEnd = () => {
    isDraggingRef.current = false;
    setLocalBpm(Math.round(localBpm)); // Snap on release
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col gap-4 p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-extrabold uppercase tracking-tighter text-white">Tempo Control</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Display + Dial Container */}
        <div className="border-2 border-[#dfff4f] rounded-xl bg-black overflow-hidden relative shadow-[0_0_20px_rgba(223,255,79,0.1)]">
          <div className="pt-8 pb-6 flex flex-col items-center justify-center bg-gradient-to-b from-black to-zinc-900/80">
            <div className={`text-7xl font-extrabold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] tracking-tighter tabular-nums leading-none transition-transform duration-75 ${isTapping ? 'scale-110 text-[#dfff4f]' : 'scale-100'}`}>
              {Math.round(localBpm)}
            </div>
            <div className={`font-extrabold text-[10px] uppercase tracking-[0.4em] mt-3 transition-colors ${isTapping ? 'text-white' : 'text-[#ff1e56]'}`}>
              Beats Per Minute
            </div>
          </div>

          {/* Dial Area */}
          <div
            className="h-28 relative bg-gradient-to-b from-zinc-900 to-black cursor-ew-resize touch-none border-t border-white/5 select-none"
            onMouseDown={(e) => handleDialStart(e.clientX)}
            onMouseMove={(e) => handleDialMove(e.clientX)}
            onMouseUp={handleDialEnd}
            onMouseLeave={handleDialEnd}
            onTouchStart={(e) => handleDialStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleDialMove(e.touches[0].clientX)}
            onTouchEnd={handleDialEnd}
          >
            {/* Center Indicator */}
            <div className="absolute left-1/2 top-4 bottom-4 w-1 bg-[#ff1e56] -translate-x-1/2 z-20 shadow-[0_0_10px_#ff1e56] rounded-full"></div>

            {/* Ticks Strip */}
            <div
              className={`absolute inset-0 ${isAnimating ? 'transition-transform duration-500' : ''}`}
              style={{
                transform: `translateX(${-localBpm * PIXELS_PER_BPM}px)`,
                transitionTimingFunction: isAnimating ? 'ease-in-out' : 'none'
              }}
            >
              {allTicks.map(val => {
                const offset = val * PIXELS_PER_BPM;
                const distToCenter = Math.abs(val - localBpm);
                return (
                  <div
                    key={val}
                    className="absolute top-0 bottom-0 flex flex-col items-center justify-center w-0 pointer-events-none"
                    style={{ left: `calc(50% + ${offset}px)` }}
                  >
                    <span className={`text-[10px] font-bold mb-3 transition-colors duration-500 ${distToCenter < 5 ? 'text-white' : 'text-zinc-600'}`}>{val}</span>
                    <div className={`w-0.5 rounded-full transition-all duration-500 ${distToCenter < 1 ? 'h-8 bg-white' : 'h-6 bg-zinc-700'}`}></div>
                  </div>
                );
              })}
            </div>

            {/* Side Fade Masks */}
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none"></div>
          </div>
        </div>

        {/* Half/Double Shortcuts */}
        <div className="flex gap-2">
          <button
            onClick={() => handleHalfDouble(0.5)}
            disabled={localBpm < 40}
            className="flex-1 py-4 bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 font-extrabold hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-in-out active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">🐌</span>
            <span className="text-[10px] uppercase tracking-wider">HALF</span>
          </button>
          <button
            onClick={() => handleHalfDouble(2.0)}
            disabled={localBpm > 150}
            className="flex-1 py-4 bg-zinc-900 border border-white/5 rounded-xl text-zinc-400 font-extrabold hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 ease-in-out active:scale-95 flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">🐰</span>
            <span className="text-[10px] uppercase tracking-wider">DOUBLE</span>
          </button>
        </div>

        {/* Tap Button */}
        <button
          onPointerDown={handleTap}
          className="w-full py-7 rounded-xl bg-[#1e1e22] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col items-center justify-center active:bg-zinc-800 transition-all active:scale-[0.98] group select-none touch-none"
        >
          <span className="text-xl font-extrabold uppercase tracking-[0.2em] text-zinc-400 group-active:text-white transition-colors">Tap</span>
          <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-600 mt-1">Tap repeatedly to set</span>
        </button>

        {/* Done Button */}
        <button onClick={onClose} className="w-full py-4 bg-white text-black font-extrabold uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-200 transition-colors shadow-lg active:scale-[0.99]">
          Done
        </button>

      </div>
    </div>
  );
};
