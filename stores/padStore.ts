
import { create } from 'zustand';
import { Pad, BankId, Envelope, SampleMetadata, TriggerMode } from '../types';
import { useAudioStore } from './audioStore';
import { PAD_COLORS, SAMPLE_SET_URL } from '../constants';
import { dbService } from '../services/dbService';

interface PadState {
  pads: Record<string, Pad>; 
  currentBank: BankId;
  selectedPadId: string;
  isHydrating: boolean;
  sampleLibrary: SampleMetadata[];
  
  initPads: () => Promise<void>;
  resetPads: () => void;
  setBank: (bank: BankId) => void;
  selectPad: (index: number) => void;
  updatePad: (index: number, updates: Partial<Pad>) => void;
  loadSample: (index: number, url: string, name: string) => Promise<void>;
  triggerPad: (index: number, velocity?: number, pitchOverrideMultiplier?: number, startTime?: number) => void;
  stopPad: (index: number) => void;
  
  // Helpers for Project Service
  setPadsFromData: (pads: Record<string, Pad>) => void;
}

const DEFAULT_ENVELOPE: Envelope = { attack: 0.001, decay: 0.1, sustain: 1, release: 0.05 };

const generateWaveform = (buffer: AudioBuffer, points: number = 200): number[] => {
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / points);
  const waveform: number[] = [];
  for (let i = 0; i < points; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) {
      const datum = Math.abs(data[i * step + j] || 0);
      if (datum > max) max = datum;
    }
    waveform.push(max);
  }
  return waveform;
};

const createBasePads = () => {
  const pads: Record<string, Pad> = {};
  const banks: BankId[] = ['A', 'B', 'C', 'D'];
  banks.forEach(bank => {
    for (let i = 0; i < 16; i++) {
      const id = `${bank}-${i}`;
      pads[id] = {
        id: `pad-${i}`,
        bankId: bank,
        sampleId: null,
        sampleName: '',
        volume: 1.0,
        pitch: 1.0,
        pan: 0,
        cutoff: 20000,
        resonance: 1, 
        start: 0,
        end: 1,
        viewStart: 0,
        viewEnd: 1,
        envelope: { ...DEFAULT_ENVELOPE },
        triggerMode: 'ONE_SHOT',
        color: PAD_COLORS[i],
        isHeld: false
      };
    }
  });
  return pads;
};

export const usePadStore = create<PadState>((set, get) => ({
  pads: createBasePads(),
  currentBank: 'A',
  selectedPadId: 'pad-0',
  isHydrating: false,
  sampleLibrary: [],

  resetPads: () => {
      set({ pads: createBasePads() });
  },

  setPadsFromData: (newPads) => {
      set({ pads: newPads });
  },

  initPads: async () => {
    set({ isHydrating: true });
    await dbService.init();
    
    const { audioContext, loadSampleToWorklet } = useAudioStore.getState();

    let library = await dbService.getSampleMetadata();
    if (library.length === 0) {
      try {
        const response = await fetch(SAMPLE_SET_URL);
        const data = await response.json();
        const base = data._base;
        const metadata: SampleMetadata[] = [];
        const bankKeys = Object.keys(data).filter(k => k !== '_base').sort();
        for (const bankName of bankKeys) {
          const files = data[bankName];
          const sortedFiles = [...files].sort();
          for (const filePath of sortedFiles) {
            const fileName = filePath.split('/').pop().split('.')[0];
            metadata.push({
              id: `${bankName}-${fileName}-${metadata.length}`,
              name: fileName,
              bank: bankName,
              url: base + filePath
            });
          }
        }
        library = metadata;
        await dbService.saveSampleMetadata(library);
      } catch (e) {
        console.error('Failed to fetch sample set', e);
      }
    }
    set({ sampleLibrary: library });

    const configs = await dbService.getAllPadConfigs();
    const storedSamples = await dbService.getAllSamples();
    const sampleMap = new Map(storedSamples.map(s => [s.id, s]));

    if (configs.length === 0 && storedSamples.length === 0) {
      const autoSamples = library.filter(s => s.bank === 'auto').slice(0, 16);
      for (let i = 0; i < autoSamples.length; i++) {
        await get().loadSample(i, autoSamples[i].url, autoSamples[i].name);
      }
    } else {
      const newPads = createBasePads();
      for (const config of configs) {
        if (newPads[config.id]) {
          const mergedPad = { ...newPads[config.id], ...config };
          if (mergedPad.sampleId && sampleMap.has(mergedPad.sampleId)) {
            const stored = sampleMap.get(mergedPad.sampleId)!;
            if (audioContext) {
              try {
                const decoded = await audioContext.decodeAudioData(stored.data.slice(0));
                mergedPad.buffer = decoded;
                if (!mergedPad.waveform) {
                  mergedPad.waveform = generateWaveform(decoded);
                  await dbService.savePadConfig(config.id, mergedPad);
                }
                loadSampleToWorklet(mergedPad.sampleId, decoded);
              } catch (e) {
                console.error(`Failed to restore sample ${mergedPad.sampleId}`, e);
              }
            }
          }
          newPads[config.id] = mergedPad;
        }
      }
      set({ pads: newPads });
    }

    set({ isHydrating: false });
  },

  setBank: (bank) => set({ currentBank: bank }),
  selectPad: (index) => set({ selectedPadId: `pad-${index}` }),

  updatePad: (index, updates) => {
    const { pads, currentBank } = get();
    const id = `${currentBank}-${index}`;
    const pad = pads[id];
    if (!pad) return;

    let finalUpdates = { ...updates };
    
    // Time manipulation logic (preserve playback progress on slice change)
    if (updates.start !== undefined || updates.end !== undefined || updates.pitch !== undefined) {
      const audioCtx = useAudioStore.getState().audioContext;
      const currentPadState = { ...pad, ...updates };
      
      if (audioCtx && currentPadState.buffer && pad.lastTriggerTime !== undefined && pad.lastTriggerDuration !== undefined) {
          const now = audioCtx.currentTime;
          const oldDuration = pad.lastTriggerDuration;
          const elapsed = now - pad.lastTriggerTime;
          const newDuration = (currentPadState.buffer.duration * (currentPadState.end - currentPadState.start)) / currentPadState.pitch;
          
          if (oldDuration > 0) {
              const progress = elapsed / oldDuration;
              const newLastTriggerTime = now - (progress * newDuration);
              finalUpdates = {
                  ...finalUpdates,
                  lastTriggerTime: newLastTriggerTime,
                  lastTriggerDuration: newDuration
              };
          }
      }
    }

    const newPads = { ...pads, [id]: { ...pad, ...finalUpdates } };
    set({ pads: newPads });
    dbService.savePadConfig(id, newPads[id]);

    // Push real-time updates to worklet
    if (updates.start !== undefined || updates.end !== undefined) {
      useAudioStore.getState().updatePadStartEnd(id, newPads[id].start, newPads[id].end);
    }
    if (updates.cutoff !== undefined || updates.resonance !== undefined) {
      useAudioStore.getState().updatePadParams(id, newPads[id].cutoff, newPads[id].resonance);
    }
  },

  loadSample: async (index, url, name) => {
    const { pads, currentBank } = get();
    const { audioContext, loadSampleToWorklet } = useAudioStore.getState();
    if (!audioContext) return;

    try {
      const resp = await fetch(url);
      const originalArrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(originalArrayBuffer.slice(0));
      const sampleId = `${currentBank}-${index}-${Date.now()}`;
      const waveform = generateWaveform(audioBuffer);
      loadSampleToWorklet(sampleId, audioBuffer);
      const id = `${currentBank}-${index}`;
      
      const updatedPad: Pad = { 
        ...pads[id], 
        sampleId,
        sampleName: name,
        buffer: audioBuffer,
        waveform,
        triggerMode: 'ONE_SHOT'
      };
      
      set(state => ({ pads: { ...state.pads, [id]: updatedPad } }));
      await dbService.saveSample({ id: sampleId, name: name, data: originalArrayBuffer, waveform });
      await dbService.savePadConfig(id, updatedPad);
    } catch (e) {
      console.error('Failed to load sample', e);
    }
  },

  triggerPad: (index, velocity = 1.0, pitchOverrideMultiplier = 1.0, startTime?: number) => {
    const { pads, currentBank } = get();
    const { triggerPad, audioContext } = useAudioStore.getState();
    const id = `${currentBank}-${index}`;
    const pad = pads[id];

    if (pad && pad.sampleId && pad.buffer && audioContext) {
      const finalPitch = pad.pitch * pitchOverrideMultiplier;
      const duration = (pad.buffer.duration * (pad.end - pad.start)) / finalPitch;
      
      triggerPad({
        padId: id,
        sampleId: pad.sampleId,
        volume: pad.volume * velocity,
        pitch: finalPitch,
        pan: pad.pan,
        start: pad.start,
        end: pad.end,
        envelope: pad.envelope,
        triggerMode: pad.triggerMode,
        cutoff: pad.cutoff,
        resonance: pad.resonance,
        startTime: startTime || audioContext.currentTime 
      });

      set(state => ({
        pads: {
          ...state.pads,
          [id]: {
            ...pad,
            isHeld: true,
            lastTriggerTime: startTime || audioContext.currentTime,
            lastTriggerDuration: duration
          }
        }
      }));
    }
  },

  stopPad: (index) => {
    const { pads, currentBank } = get();
    const id = `${currentBank}-${index}`;
    const pad = pads[id];
    if (pad) {
      set(state => ({
        pads: {
          ...state.pads,
          [id]: { ...pad, isHeld: false }
        }
      }));
    }
    useAudioStore.getState().stopPad(id);
  }
}));
