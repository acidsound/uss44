
import React, { useState } from 'react';
import { Sliders, Scissors, Settings2, Edit2 } from 'lucide-react';
import { usePadStore } from '../stores/padStore';
import { WaveformEditor } from './WaveformEditor';
import { Knob } from './Knob';
import { RenameModal } from './RenameModal';

interface ParametersPanelProps {
  isLandscape: boolean;
  isUltraSampleMode?: boolean;
}

export const ParametersPanel: React.FC<ParametersPanelProps> = ({ isLandscape, isUltraSampleMode = false }) => {
  const [editSubMode, setEditSubMode] = useState<'CHOP' | 'CONTROL'>('CHOP');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const { currentChannel, selectedPadId, pads, samples, updatePad, updateSampleName } = usePadStore();

  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const activePad = pads[`${currentChannel}-${selectedPadIndex}`];

  const handleRenameSave = (newName: string) => {
    if (activePad) {
      updatePad(selectedPadIndex, { name: newName });
    }
  };

  return (
    <div id="parameters-panel" className="flex flex-col h-full overflow-hidden relative">
      {/* Rename Modal */}
      {showRenameModal && activePad && (
        <RenameModal
          initialName={activePad.name || (activePad.sampleId ? samples[activePad.sampleId]?.name : '') || ''}
          onSave={handleRenameSave}
          onClose={() => setShowRenameModal(false)}
        />
      )}

      {/* Panel Header */}
      <div id="parameters-header" className="h-6 border-b border-zinc-800/50 flex items-center px-4 justify-between bg-zinc-800/30 flex-none">
        <div className="flex items-stretch h-full gap-2">
          <div className="flex items-center gap-1 text-[11px] font-bold text-retro-accent uppercase tracking-tighter">
            <Sliders size={14} /> {isUltraSampleMode ? 'Live Input Monitor' : 'Params'}
          </div>
          {!isLandscape && !isUltraSampleMode && (
            <div id="submode-toggles" className="flex items-stretch bg-black/20 rounded-t-lg overflow-hidden">
              <button
                id="toggle-chop"
                onClick={() => setEditSubMode('CHOP')}
                className={`w-16 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-all ${editSubMode === 'CHOP' ? 'text-white bg-retro-accent/20 border-b-2 border-retro-accent' : 'text-zinc-500 hover:text-white'}`}
              >
                <Scissors size={12} /> Chop
              </button>
              <button
                id="toggle-control"
                onClick={() => setEditSubMode('CONTROL')}
                className={`w-16 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-all ${editSubMode === 'CONTROL' ? 'text-white bg-retro-accent/20 border-b-2 border-retro-accent' : 'text-zinc-500 hover:text-white'}`}
              >
                <Settings2 size={12} /> CTRL
              </button>
            </div>
          )}
        </div>

        {/* Pad Naming Trigger */}
        {!isUltraSampleMode && (
          <button
            id="pad-naming-container"
            onClick={() => setShowRenameModal(true)}
            className="flex items-center gap-1 border-l border-zinc-800/50 pl-2 h-full cursor-pointer hover:bg-white/5 transition-colors group outline-none"
          >
            <Edit2 size={12} className="text-zinc-500 group-hover:text-white transition-colors flex-none" />
            <span
              className="text-[11px] font-bold text-white w-28 uppercase truncate text-left group-hover:text-retro-accent transition-colors block"
            >
              {activePad?.name || (activePad?.sampleId ? samples[activePad.sampleId]?.name : null) || 'EMPTY'}
            </span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div id="parameters-content" className="flex-1 overflow-hidden min-h-0">
        {isLandscape ? (
          <div className="flex flex-col h-full">
            <div id="landscape-waveform" className="flex-1 min-h-0 border-b border-zinc-800/50 bg-black/40">
              <WaveformEditor isUltraSampleMode={isUltraSampleMode} />
            </div>
            {!isUltraSampleMode && (
              <div id="landscape-knobs" className="h-1/3 min-h-[140px] bg-zinc-900/10 overflow-y-auto grid grid-cols-5 gap-2 p-2 place-items-center content-center">
                <Knob label="Pitch" min={0.1} max={4.0} value={activePad?.pitch || 1} defaultValue={1} onChange={(v) => updatePad(selectedPadIndex, { pitch: v })} />
                <Knob label="Gain" min={0} max={2.0} value={activePad?.volume || 1} defaultValue={1} onChange={(v) => updatePad(selectedPadIndex, { volume: v })} />
                <Knob label="Pan" min={-1} max={1} value={activePad?.pan || 0} defaultValue={0} onChange={(v) => updatePad(selectedPadIndex, { pan: v })} />
                <Knob label="CUT OFF" min={0.02} max={20.0} value={(activePad?.cutoff || 20000) / 1000} defaultValue={20.0} onChange={(v) => updatePad(selectedPadIndex, { cutoff: v * 1000 })} />
                <Knob label="Res" min={0} max={20} value={activePad?.resonance || 0} defaultValue={0} onChange={(v) => updatePad(selectedPadIndex, { resonance: v })} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full">
            {(isUltraSampleMode || editSubMode === 'CHOP') ? (
              <div id="portrait-waveform" className="flex-1 min-w-0 bg-black/40">
                <WaveformEditor isUltraSampleMode={isUltraSampleMode} />
              </div>
            ) : (
              <div id="portrait-knobs" className="flex-1 flex items-center justify-around bg-black/40 p-1 overflow-hidden">
                <div className="flex items-center justify-between w-full max-w-[600px] gap-0.5 sm:gap-4 scale-[0.85] xs:scale-100 transition-transform origin-center">
                  <Knob label="Pitch" min={0.1} max={4.0} value={activePad?.pitch || 1} defaultValue={1} onChange={(v) => updatePad(selectedPadIndex, { pitch: v })} />
                  <Knob label="Gain" min={0} max={2.0} value={activePad?.volume || 1} defaultValue={1} onChange={(v) => updatePad(selectedPadIndex, { volume: v })} />
                  <Knob label="Pan" min={-1} max={1} value={activePad?.pan || 0} defaultValue={0} onChange={(v) => updatePad(selectedPadIndex, { pan: v })} />
                  <Knob label="CUT OFF" min={0.02} max={20.0} value={(activePad?.cutoff || 20000) / 1000} defaultValue={20.0} onChange={(v) => updatePad(selectedPadIndex, { cutoff: v * 1000 })} />
                  <Knob label="Res" min={0} max={20} value={activePad?.resonance || 0} defaultValue={0} onChange={(v) => updatePad(selectedPadIndex, { resonance: v })} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
