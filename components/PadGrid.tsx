
import React, { useRef, useEffect } from 'react';
import { usePadStore } from '../stores/padStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { AppMode } from '../types';
import { Mic, Activity } from 'lucide-react';

interface PadGridProps {
  appMode?: AppMode;
  isEditMode?: boolean;
  isUltraSampleMode?: boolean;
  onUltraRecordStart?: (index: number) => void;
  onUltraRecordStop?: (index: number) => void;
}

/**
 * Tracks which pad is being interacted with by which pointer/touch.
 * Key is the pointerId or touch identifier.
 * Value is the pad index.
 */
type InteractionMap = Map<number | string, number>;

export const PadGrid: React.FC<PadGridProps> = ({
  appMode = AppMode.PERFORM,
  isEditMode = false,
  isUltraSampleMode = false,
  onUltraRecordStart,
  onUltraRecordStop
}) => {
  const { pads, samples, currentChannel, selectedPadId, selectPad, triggerPad, stopPad, isCloneMode, setCloneMode, executeClone } = usePadStore();
  const { currentStep, isPlaying, patterns, toggleStep, setSelectedStepIndex, selectedStepIndex } = useSequencerStore();

  const isSequenceMode = appMode === AppMode.SEQUENCE;
  const selectedPadIndex = parseInt(selectedPadId.split('-').pop() || '0');
  const activePattern = patterns[`${currentChannel}-${selectedPadIndex}`];

  // Map to track multiple touches/pointer interactions independently
  const activeInteractionsRef = useRef<InteractionMap>(new Map());
  const isTouchActiveRef = useRef<boolean>(false);

  const handlePadStart = (idx: number, interactionId: number | string) => {
    const oldIdx = activeInteractionsRef.current.get(interactionId);
    if (oldIdx === idx) return;

    // If we're already interacting with another pad (e.g. via mouse drag or touch slide), end that one first
    if (oldIdx !== undefined && oldIdx !== idx) {
      handlePadEnd(interactionId);
    }

    if (idx < 0 || idx >= gridSize) return;

    if (isCloneMode) {
      executeClone(idx);
    } else if (isUltraSampleMode && onUltraRecordStart) {
      onUltraRecordStart(idx);
    } else if (isSequenceMode) {
      if (isEditMode) {
        setSelectedStepIndex(idx);
      } else {
        toggleStep(currentChannel, selectedPadIndex, idx);
        setSelectedStepIndex(idx);
      }
    } else if (isEditMode) {
      selectPad(idx);
    } else {
      selectPad(idx);
      triggerPad(idx);
    }

    activeInteractionsRef.current.set(interactionId, idx);
  };

  const handlePadEnd = (interactionId: number | string) => {
    const idx = activeInteractionsRef.current.get(interactionId);
    if (idx === undefined) return;

    if (isUltraSampleMode && onUltraRecordStop) {
      onUltraRecordStop(idx);
    } else if (!isSequenceMode && !isEditMode) {
      stopPad(idx);
    }

    activeInteractionsRef.current.delete(interactionId);
  };

  // --- Mouse Events ---
  const handleMouseDown = (idx: number, e: React.MouseEvent) => {
    if (isTouchActiveRef.current) return;
    handlePadStart(idx, 'mouse');
  };

  const handleMouseEnter = (idx: number, e: React.MouseEvent) => {
    if (isTouchActiveRef.current) return;
    if (e.buttons === 1) {
      handlePadStart(idx, 'mouse');
    }
  };

  const handleMouseLeave = (idx: number) => {
    if (isTouchActiveRef.current) return;
    // We don't necessarily end the interaction on leave if we want to allow dragging across pads
    // Moving the handlePadEnd logic to global mouseUp ensures it stops even if released outside
  };

  const containerRef = useRef<HTMLDivElement>(null);

  /* Hook logic */
  const { stepCount } = useSequencerStore();

  // Calculate grid size early for dependency usage
  const gridSize = isSequenceMode ? stepCount : 16;

  /* Touch Handlers */
  // ... (previous logic)

  useEffect(() => {
    const onWindowMouseUp = () => {
      if (activeInteractionsRef.current.has('mouse')) {
        handlePadEnd('mouse');
      }
    };
    window.addEventListener('mouseup', onWindowMouseUp);

    const container = containerRef.current;
    if (!container) return () => window.removeEventListener('mouseup', onWindowMouseUp);

    const onTouchStart = (e: TouchEvent) => {
      isTouchActiveRef.current = true;
      if (e.cancelable) e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const padElement = element?.closest('[data-pad-index]');
        const idx = padElement ? parseInt(padElement.getAttribute('data-pad-index') || '-1') : -1;

        if (idx !== -1) {
          handlePadStart(idx, touch.identifier);
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const padElement = element?.closest('[data-pad-index]');
        const newIdx = padElement ? parseInt(padElement.getAttribute('data-pad-index') || '-1') : -1;

        handlePadStart(newIdx === -1 ? -1 : newIdx, touch.identifier);
        // Note: handlePadStart(-1) will end the previous interaction for that touch
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        handlePadEnd(touch.identifier);
      }

      if (e.touches.length === 0) {
        setTimeout(() => { isTouchActiveRef.current = false; }, 200);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [currentChannel, selectedPadIndex, appMode, isEditMode, isSequenceMode, isUltraSampleMode, isCloneMode, onUltraRecordStart, onUltraRecordStop, executeClone, selectPad, stepCount, gridSize]);

  const gridClass = gridSize === 64 ? 'grid-cols-8 grid-rows-8' : 'grid-cols-4 grid-rows-4';

  // Helper to distinguish 4x4 blocks in 64-step mode (Quadrant view)
  const getBlockStyles = (index: number) => {
    if (gridSize !== 64) return '';
    const classes = [];

    const row = Math.floor(index / 8);
    const col = index % 8;

    // Quadrant visual separation (Split into four 4x4 regions)
    if (col === 3) classes.push('mr-1'); // Vertical gap
    if (row === 3) classes.push('mb-1'); // Horizontal gap

    // Quadrant Coloring
    const qRow = row < 4 ? 0 : 1;
    const qCol = col < 4 ? 0 : 1;
    const qIdx = qRow * 2 + qCol;

    // Q0 (TL): Default
    if (qIdx > 0) {
      classes.push("after:content-[''] after:absolute after:inset-0 after:pointer-events-none");
      // Q1 (TR): Blue tint
      if (qIdx === 1) classes.push('after:bg-sky-500/10');
      // Q2 (BL): Purple tint
      if (qIdx === 2) classes.push('after:bg-purple-500/10');
      // Q3 (BR): Emerald tint
      if (qIdx === 3) classes.push('after:bg-emerald-500/10');
    }

    return classes.join(' ');
  };

  return (
    <>
      <div
        ref={containerRef}
        id="pad-grid"
        className={`grid ${gridClass} gap-2 w-full h-full touch-none`}
      >
        {Array.from({ length: gridSize }).map((_, idx) => {
          const pad = pads[`${currentChannel}-${idx}`];

          // Sequence Mode: Grid represents 16 Steps for the SELECTED pad
          // Perform Mode: Grid represents 16 Pads for the SELECTED channel

          const stepData = activePattern ? activePattern[idx] : null;

          // Sequence Mode: Playhead visualization (Highlight the step corresponding to currentStep)
          const isPlayhead = isSequenceMode && isPlaying && currentStep === idx;

          // Perform Mode: Playback visualization (Highlight the pad if it is playing right now)
          const padPatternKey = `${currentChannel}-${idx}`;
          const padSpecificPattern = patterns[padPatternKey];
          const isTriggeredBySeq = !isSequenceMode && isPlaying && padSpecificPattern?.[currentStep]?.active;

          const isSelected = isSequenceMode ? selectedStepIndex === idx : selectedPadId === `pad-${idx}`;
          const hasSample = !isSequenceMode && !!pad?.sampleId;
          const isActiveStep = isSequenceMode && stepData?.active;

          // Check if this pad is being held by ANY interaction
          const isHeldLocally = Array.from(activeInteractionsRef.current.values()).includes(idx);

          // Mute/Solo Logic for dimming
          const isMuted = pad?.mute;
          const isSoloed = pad?.solo;
          const allPadsValues = Object.values(pads);
          const anySoloed = allPadsValues.some(p => p.solo);
          const isEffectivelySilenced = !isSequenceMode && (isMuted || (anySoloed && !isSoloed));

          // Dynamic Class Construction
          let bgClass = '';
          let borderClass = '';
          let shadowClass = '';
          let ringClass = '';

          let stepBorderEffect = {};
          let stepLedStyle = {};

          if (isSequenceMode) {
            // Sequence Mode Styling
            if (isPlayhead) {
              // Playhead Cursor
              bgClass = 'bg-white/20';
              borderClass = 'border-emerald-400';
              shadowClass = 'shadow-[0_0_15px_rgba(52,211,153,0.5)]';
            } else if (isActiveStep) {
              // Active Step
              const velocity = Math.round(stepData?.velocity || 0);
              const velFactor = velocity / 127;
              // 0 velocity should be very dark (ghost note), 1 should be slightly visible
              const intensity = velocity === 0 ? 0.05 : 0.2 + (velFactor * 0.8);

              bgClass = 'bg-zinc-800';
              // Use inline styles for dynamic brightness
              stepBorderEffect = {
                borderColor: `rgba(255, 30, 86, ${intensity})`,
                boxShadow: velocity === 0 ? 'none' : `0 0 ${8 * velFactor}px rgba(255, 30, 86, ${0.4 * velFactor})`
              };
              shadowClass = ''; // Handled by inline style

              stepLedStyle = {
                backgroundColor: `rgba(255, 30, 86, ${intensity})`,
                boxShadow: velocity === 0 ? 'none' : `0 0 ${10 * velFactor}px rgba(255, 30, 86, ${0.8 * velFactor})`
              };
            } else {
              // Inactive Step
              bgClass = 'bg-retro-pad';
              borderClass = 'border-zinc-800/80 hover:border-zinc-600';
            }

            if (isSelected) {
              ringClass = 'ring-4 ring-white/10 z-10';
              borderClass = 'border-white';
              stepBorderEffect = {}; // Reset inline border if selected to let border-white win
            }

          } else {
            // Perform Mode Styling
            if (isUltraSampleMode) {
              if (isSelected) {
                bgClass = 'bg-retro-accent';
                borderClass = 'border-white';
                ringClass = 'ring-4 ring-white/10';
              } else if (hasSample) {
                bgClass = 'bg-zinc-700';
                borderClass = 'border-retro-accent/50';
              } else {
                bgClass = 'bg-zinc-800';
                borderClass = 'border-zinc-700';
              }
            } else if (isCloneMode) {
              bgClass = 'bg-zinc-900';
              borderClass = 'border-dashed border-zinc-700 hover:border-retro-accent hover:bg-zinc-800';
            } else {
              if (isSelected) {
                bgClass = 'bg-zinc-700';
                borderClass = 'border-white';
                ringClass = 'ring-4 ring-white/10 z-10';
              } else {
                bgClass = 'bg-retro-pad';
                borderClass = 'border-zinc-800/80 hover:border-zinc-600';
              }
            }
          }

          const opacityClass = isEffectivelySilenced ? 'opacity-30 grayscale' : 'opacity-100';
          if (isTriggeredBySeq) {
            // Seq Trigger in Perform Mode
            ringClass = 'ring-4 ring-retro-accent/60 z-20';
            bgClass = 'bg-retro-accent/20';
            shadowClass = 'shadow-[0_0_20px_rgba(255,30,86,0.4)]';
            borderClass = 'border-retro-accent';
          }

          // Opacity / Grayscale
          const isDimmed = !isSequenceMode && !hasSample && !isUltraSampleMode && !isCloneMode;
          const blockStyle = getBlockStyles(idx);

          return (
            <button
              key={idx}
              id={`pad-${idx}`}
              data-pad-index={idx}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onMouseUp={() => handlePadEnd('mouse')}
              onMouseEnter={(e) => handleMouseEnter(idx, e)}
              onMouseLeave={() => handleMouseLeave(idx)}
              style={stepBorderEffect}
              className={`
                relative transition-all duration-75 flex flex-col items-center justify-center overflow-hidden rounded-xl
                border active:shadow-none active:translate-x-[2px] active:translate-y-[2px]
                w-full h-full min-h-0 min-w-0
                ${bgClass} ${borderClass} ${shadowClass} ${ringClass}
                ${(isDimmed || isEffectivelySilenced) ? 'opacity-30 grayscale' : 'opacity-100'}
                ${isTriggeredBySeq ? 'scale-[0.98]' : ''}
                ${isHeldLocally && !isSequenceMode && !isCloneMode ? 'translate-x-[1px] translate-y-[1px] shadow-none brightness-110' : ''}
                ${!isSequenceMode && !isUltraSampleMode ? 'shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]' : ''}
                ${isCloneMode ? 'cursor-copy' : ''}
                ${blockStyle}
              `}
            >
              {/* Solo/Mute Indicators */}
              {!isSequenceMode && (
                <div className="absolute top-1 right-1 flex gap-1 pointer-events-none">
                  {isSoloed && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_#f59e0b] animate-pulse" />}
                  {isMuted && <div className="w-2 h-2 rounded-full bg-retro-accent shadow-[0_0_5px_#ff1e56]" />}
                </div>
              )}
              {/* LED Indicator */}
              <div className={`absolute top-2 left-2 w-2 h-2 rounded-full border border-black/50 shadow-sm transition-colors duration-75
                ${isSequenceMode
                  ? (isPlayhead ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : isActiveStep ? 'bg-retro-accent shadow-[0_0_8px_#ff1e56]' : 'bg-zinc-900')
                  : (isHeldLocally || isSelected || isTriggeredBySeq ? 'bg-retro-accent shadow-[0_0_8px_#ff1e56]' : 'bg-zinc-900')
                }`}
                style={Object.keys(stepLedStyle).length > 0 && !isPlayhead ? stepLedStyle : {}}
              ></div>

              {/* Visual indicator for UltraSample/Clone Mode */}
              {isUltraSampleMode && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                  {hasSample ? (
                    <Activity className="text-retro-accent w-10 h-10 drop-shadow-[0_0_5px_rgba(255,30,86,0.8)]" />
                  ) : (
                    <Mic className="text-zinc-600 w-8 h-8" />
                  )}
                </div>
              )}

              {isCloneMode && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <Activity className="w-12 h-12 text-zinc-400" />
                </div>
              )}

              <div className="flex flex-col items-center w-full px-2 pointer-events-none z-10 min-h-0 min-w-0">
                <span className={`font-extrabold ${isSequenceMode ? 'text-[8px] absolute top-1 right-1 opacity-40' : 'text-[11px] mb-1'} uppercase tracking-tighter ${isSelected || isActiveStep || isUltraSampleMode || isHeldLocally || isTriggeredBySeq || isPlayhead || isCloneMode ? 'text-white' : 'text-zinc-500'}`}>
                  {isSequenceMode ? idx + 1 : `PAD ${idx + 1}`}
                </span>

                {!isSequenceMode && pad?.sampleId && samples[pad.sampleId]?.name && (
                  <span className={`text-[9px] font-extrabold truncate max-w-[95%] uppercase leading-none drop-shadow-md ${isUltraSampleMode ? 'text-retro-accent' : 'text-white'}`}>
                    {samples[pad.sampleId].name}
                  </span>
                )}

                {isUltraSampleMode && (
                  <span className="text-[8px] text-retro-accent font-extrabold uppercase tracking-widest leading-none mt-1">
                    {isHeldLocally ? 'REC' : (hasSample ? 'HOLD TO OVERWRITE' : 'HOLD TO RECORD')}
                  </span>
                )}

                {isCloneMode && (
                  <span className="text-[8px] text-zinc-400 font-extrabold uppercase tracking-tight leading-none mt-1">
                    Select Target
                  </span>
                )}

                {/* Pitch indicator (Vertical Line on right) */}
                {isSequenceMode && stepData?.active && stepData.pitch !== 0 && (
                  <div className="absolute top-2 bottom-5 right-1.5 w-[3px] bg-white/5 rounded-full pointer-events-none overflow-hidden">
                    <div
                      className={`absolute left-0 w-full rounded-full ${stepData.pitch > 0 ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`}
                      style={{
                        bottom: '50%',
                        height: `${Math.min(50, Math.abs(stepData.pitch / 48) * 100)}%`,
                        transformOrigin: 'bottom',
                        transform: stepData.pitch > 0 ? 'scaleY(1)' : 'scaleY(-1)'
                      }}
                    />
                  </div>
                )}

                {isSequenceMode && stepData?.active && (
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none">
                    {/* Length bar */}
                    <div className="w-full h-[3px] bg-white/10">
                      <div
                        className="h-full bg-emerald-400/40"
                        style={{ width: `${Math.min(100, (stepData.length / 16) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Playing Animation */}
              {(isTriggeredBySeq || (isUltraSampleMode && isHeldLocally) || (isHeldLocally && !isSequenceMode)) && (
                <div className="absolute inset-0 bg-retro-accent/20 animate-pulse pointer-events-none"></div>
              )}

              {/* Channel Color Indicator */}
              {!isSequenceMode && hasSample && !isUltraSampleMode && (
                <div className={`absolute bottom-0 w-full h-1.5 ${pad.color.replace('bg-', 'bg-opacity-100 bg- shadow-[0_-2px_10px_rgba(0,0,0,0.5)] bg-')}`}></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Clone Mode Overlay/Indicator */}
      {isCloneMode && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 border-2 border-retro-accent rounded-full px-6 py-2 flex items-center gap-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <Activity className="text-retro-accent animate-pulse" size={16} />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Clone Mode Active</span>
          </div>
          <button
            onClick={() => setCloneMode(null)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-all"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
};
