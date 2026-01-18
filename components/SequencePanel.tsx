
import React from 'react';
import { Music } from 'lucide-react';
import { usePadStore } from '../stores/padStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { Knob } from './Knob';

export const SequencePanel: React.FC = () => {
  const { currentChannel, selectedPadId, pads, samples } = usePadStore();
  const { patterns, selectedStepIndex, updateStepData } = useSequencerStore();

  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const activePad = pads[`${currentChannel}-${selectedPadIndex}`];
  const activePattern = patterns[`${currentChannel}-${selectedPadIndex}`];
  const activeStepData = activePattern ? activePattern[selectedStepIndex] : null;

  const sampleName = activePad?.name || (activePad?.sampleId ? samples[activePad.sampleId]?.name : null);

  return (
    <div id="sequence-panel" className="flex flex-col h-full overflow-hidden">
      <div id="sequence-header" className="h-6 border-b border-zinc-800/50 flex items-center px-4 justify-between bg-zinc-800/30 flex-none">
        <div className="flex items-center gap-2 text-[11px] font-extrabold text-retro-accent uppercase tracking-tighter">
          <Music size={14} /> Sequence Editor <span className="text-white ml-1">#Step {selectedStepIndex + 1}</span>
        </div>
        <div id="sequence-active-pad-name" className="text-[10px] text-zinc-500 font-bold uppercase">
          {sampleName || 'Empty'}
        </div>
      </div>
      <div id="sequence-controls" className="flex-1 grid grid-cols-3 gap-4 p-2 place-items-center bg-black/40">
        <Knob label="Velocity" min={0} max={127} value={activeStepData?.velocity || 0} defaultValue={100} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { velocity: Math.round(v) })} precision={0} />
        <Knob label="Pitch" min={-24} max={24} value={activeStepData?.pitch || 0} defaultValue={0} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { pitch: Math.round(v) })} />
        <Knob label="Length" min={0.1} max={16.0} value={activeStepData?.length || 1.0} defaultValue={1.0} onChange={(v) => updateStepData(currentChannel, selectedPadIndex, selectedStepIndex, { length: v })} />
      </div>
    </div>
  );
};
