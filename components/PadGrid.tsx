
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
  const { pads, samples, currentChannel, selectedPadId, selectPad, triggerPad, stopPad } = usePadStore();
  const { currentStep, isPlaying, patterns, toggleStep, setSelectedStepIndex, selectedStepIndex } = useSequencerStore();

  const isSequenceMode = appMode === AppMode.SEQUENCE;
  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const activePattern = patterns[`${currentChannel}-${selectedPadIndex}`];

  // Map to track multiple touches/pointer interactions independently
  const activeInteractionsRef = useRef<InteractionMap>(new Map());
  const isTouchActiveRef = useRef<boolean>(false);

  const handlePadStart = (idx: number, interactionId: number | string) => {
    const oldIdx = activeInteractionsRef.current.get(interactionId);
    if (oldIdx === idx) return;

    // If we're already interacting with another pad (e.g. via mouse drag or touch slide), end that one first
    if (oldIdx !== undefined) {
      handlePadEnd(interactionId);
    }

    if (isUltraSampleMode && onUltraRecordStart) {
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
  }, [currentChannel, selectedPadIndex, appMode, isEditMode, isSequenceMode, isUltraSampleMode, onUltraRecordStart, onUltraRecordStop]);

  return (
    <div
      ref={containerRef}
      id="pad-grid"
      className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full touch-none"
    >
      {Array.from({ length: 16 }).map((_, idx) => {
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
        const isDimmed = !isSequenceMode && !hasSample && !isUltraSampleMode;

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
              border-2 active:shadow-none active:translate-x-[2px] active:translate-y-[2px]
              w-full h-full min-h-0 min-w-0
              ${bgClass} ${borderClass} ${shadowClass} ${ringClass}
              ${(isDimmed || isEffectivelySilenced) ? 'opacity-30 grayscale' : 'opacity-100'}
              ${isTriggeredBySeq ? 'scale-[0.98]' : ''}
              ${isHeldLocally && !isSequenceMode ? 'translate-x-[1px] translate-y-[1px] shadow-none brightness-110' : ''}
              ${!isSequenceMode && !isUltraSampleMode ? 'shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]' : ''}
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

            {/* Visual indicator for UltraSample Mode */}
            {isUltraSampleMode && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                {hasSample ? (
                  <Activity className="text-retro-accent w-10 h-10 drop-shadow-[0_0_5px_rgba(255,30,86,0.8)]" />
                ) : (
                  <Mic className="text-zinc-600 w-8 h-8" />
                )}
              </div>
            )}

            <div className="flex flex-col items-center w-full px-2 pointer-events-none z-10 min-h-0 min-w-0">
              <span className={`font-extrabold text-[11px] uppercase tracking-tighter mb-1 ${isSelected || isActiveStep || isUltraSampleMode || isHeldLocally || isTriggeredBySeq || isPlayhead ? 'text-white' : 'text-zinc-500'}`}>
                {isSequenceMode ? `S${idx + 1}` : `PAD ${idx + 1}`}
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

              {isSequenceMode && stepData?.active && (
                <div className="flex flex-col items-center mt-1 w-full gap-0.5">
                  <span className="text-[8px] font-extrabold text-white leading-none">VEL:{Math.round(stepData.velocity)}</span>
                  {stepData.pitch !== 0 && <span className="text-[8px] font-extrabold text-retro-accent leading-none">P:{Math.round(stepData.pitch)}</span>}
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
  );
};
