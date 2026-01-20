import React from 'react';
import { Music } from 'lucide-react';
import { usePadStore } from '../stores/padStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { Knob } from './Knob';

export const SequencePanel: React.FC = () => {
  const { currentChannel, selectedPadId, pads, samples } = usePadStore();
  const {
    patterns,
    selectedStepIndex,
    updateStepData,
    activePatternId,
    setActivePatternId,
    createPattern
  } = useSequencerStore();

  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const activePad = pads[`${currentChannel}-${selectedPadIndex}`];
  const activePattern = patterns[`${currentChannel}-${selectedPadIndex}`];
  const activeStepData = activePattern ? activePattern[selectedStepIndex] : null;

  const sampleName = activePad?.name || (activePad?.sampleId ? samples[activePad.sampleId]?.name : null);

  const patternLetters = Array.from({ length: 16 }, (_, i) => String.fromCharCode(65 + i));

  return (
    <div id="sequence-panel" className="flex flex-col h-full overflow-hidden bg-zinc-900">

      {/* 1. Header (h-6, refined gaps) */}
      <div id="sequence-header" className="h-6 border-b border-zinc-800/50 flex items-center px-4 justify-between bg-zinc-800/30 flex-none gap-1">
        <div className="flex items-center gap-1 text-[10px] font-extrabold text-retro-accent uppercase tracking-tighter shrink-0">
          <Music size={12} /> Sequence <span className="text-white ml-1">#Step {selectedStepIndex + 1}</span>
        </div>

        <div id="sequence-active-pad-name" className="text-[9px] text-zinc-500 font-bold uppercase shrink-0 truncate max-w-[120px]">
          {sampleName || 'Empty'}
        </div>
      </div>

      {/* 2. Pattern Selector (Moved here, 16 patterns A-P) */}
      <div id="pattern-selector" className="flex-none p-1 border-b border-zinc-800/50 bg-black/20 overflow-x-auto no-scrollbar">
        <div className="flex bg-black/40 rounded p-0.5 gap-0.5 w-max">
          {patternLetters.map((letter, i) => {
            const id = `ptn-${i}`;
            const isActive = activePatternId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  createPattern(id); // Ensures it exists
                  setActivePatternId(id);
                }}
                className={`
                  w-5 h-5 flex items-center justify-center text-[9px] font-extrabold rounded-sm transition-all shrink-0
                  ${isActive ? 'bg-retro-accent text-white shadow-[0_0_10px_rgba(255,30,86,0.3)]' : 'text-zinc-500 hover:text-white hover:bg-white/10'}
                `}
                title={`Pattern ${letter}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Controls (Removed gap-4) */}
      <div id="sequence-controls" className="flex-1 grid grid-cols-3 p-2 place-items-center bg-black/40">
        <Knob label="Velocity" min={0} max={127} value={activeStepData?.velocity || 0} defaultValue={100} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { velocity: Math.round(v) })} precision={0} />
        <Knob label="Pitch" min={-24} max={24} value={activeStepData?.pitch || 0} defaultValue={0} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { pitch: Math.round(v) })} />
        <Knob label="Length" min={0.1} max={16.0} value={activeStepData?.length || 1.0} defaultValue={1.0} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { length: v })} />
      </div>

    </div>
  );
};
