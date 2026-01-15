
import { create } from 'zustand';
import { Pad, ChannelId, Envelope, SampleMetadata, TriggerMode } from '../types';
import { useAudioStore } from './audioStore';
import { PAD_COLORS, SAMPLE_SET_URL } from '../constants';
import { dbService } from '../services/dbService';

interface PadState {
  pads: Record<string, Pad>;
  currentChannel: ChannelId;
  selectedPadId: string;
  isHydrating: boolean;
  sampleLibrary: SampleMetadata[];

  initPads: () => Promise<void>;
  resetPads: () => void;
  setChannel: (channel: ChannelId) => void;
  selectPad: (index: number) => void;
  updatePad: (index: number, updates: Partial<Pad>) => void;
  loadSample: (index: number, url: string, name: string) => Promise<void>;
  triggerPad: (index: number, velocity?: number, pitchOverrideMultiplier?: number, startTime?: number, channelId?: ChannelId) => void;
  stopPad: (index: number, startTime?: number, channelId?: ChannelId) => void;
  toggleMute: (index: number) => void;
  toggleSolo: (index: number) => void;
  clearPad: (index: number) => void;

  // Sample Pack Management
  samplePacks: any[]; // SamplePack[]
  currentSamplePackId: string;
  loadSamplePack: (packId: string) => Promise<void>;
  addSamplePack: (name: string, url: string) => Promise<void>;
  deleteSamplePack: (packId: string) => Promise<void>;
  updateSamplePack: (id: string, updates: any) => Promise<void>;

  // Helpers for Project Service
  setPadsFromData: (pads: Record<string, Pad>) => void;
  resetAllPads: () => void;
}

const DEFAULT_ENVELOPE: Envelope = { attack: 0.001, decay: 0.1, sustain: 1, release: 0.05 };

export const generateWaveform = (buffer: AudioBuffer, points: number = 200): number[] => {
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
  const channels: ChannelId[] = ['A', 'B', 'C', 'D'];
  channels.forEach(channel => {
    for (let i = 0; i < 16; i++) {
      const id = `${channel}-${i}`;
      pads[id] = {
        id: `pad-${i}`,
        channelId: channel,
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
        isHeld: false,
        mute: false,
        solo: false
      };
    }
  });
  return pads;
};

export const usePadStore = create<PadState>((set, get) => ({
  pads: createBasePads(),
  currentChannel: 'A',
  selectedPadId: 'pad-0',
  isHydrating: false,
  sampleLibrary: [],
  samplePacks: [],
  currentSamplePackId: 'factory-default',

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

    // Load Sample Packs
    let packs = await dbService.getAllSamplePacks();
    const defaultPack = { id: 'factory-default', name: 'Factory Default', url: SAMPLE_SET_URL, isDefault: true };
    if (packs.length === 0) {
      await dbService.saveSamplePack(defaultPack);
      packs = [defaultPack];
    }
    set({ samplePacks: packs });

    let currentPackId = await dbService.getMetadata('current_sample_pack_id');
    if (!currentPackId) currentPackId = 'factory-default';
    set({ currentSamplePackId: currentPackId });

    const currentPack = packs.find(p => p.id === currentPackId) || defaultPack;

    let library = await dbService.getSampleMetadata();
    // If library is empty or current pack doesn't match IDB library, refetch
    // For simplicity, we'll refetch if currentPackId changed or library is empty
    const lastActivePackId = await dbService.getMetadata('last_active_pack_id');

    if (library.length === 0 || lastActivePackId !== currentPackId) {
      try {
        const response = await fetch(currentPack.url);
        const data = await response.json();
        const base = data._base || '';
        const metadata: SampleMetadata[] = [];
        const bankKeys = Object.keys(data).filter(k => k !== '_base').sort();
        for (const bankName of bankKeys) {
          const files = data[bankName];
          const sortedFiles = Array.isArray(files) ? [...files].sort() : [];
          for (const filePath of sortedFiles) {
            const fileName = filePath.split('/').pop()?.split('.')[0] || 'Unknown';
            metadata.push({
              id: `${currentPackId}-${bankName}-${fileName}-${metadata.length}`,
              name: fileName,
              bank: bankName,
              url: (base.startsWith('http') ? base : (currentPack.url.split('/').slice(0, -1).join('/') + '/' + base)) + filePath
            });
          }
        }
        library = metadata;
        await dbService.saveSampleMetadata(library);
        await dbService.saveMetadata('last_active_pack_id', currentPackId);
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
      await Promise.all(autoSamples.map((sample, i) => get().loadSample(i, sample.url, sample.name)));
    } else {
      const newPads = createBasePads();

      const decodePromises = configs
        .filter(config => {
          const merged = { ...newPads[config.id], ...config };
          return merged.sampleId && sampleMap.has(merged.sampleId) && audioContext;
        })
        .map(async (config) => {
          const mergedPad = { ...newPads[config.id], ...config };
          const stored = sampleMap.get(mergedPad.sampleId!)!;
          try {
            let decoded: AudioBuffer;
            try {
              decoded = await audioContext!.decodeAudioData(stored.data.slice(0));
            } catch (decodeErr) {
              const floatData = new Float32Array(stored.data);
              decoded = audioContext!.createBuffer(1, floatData.length, audioContext!.sampleRate);
              decoded.copyToChannel(floatData, 0);
            }

            mergedPad.buffer = decoded;
            if (!mergedPad.waveform || mergedPad.waveform.length === 0) {
              mergedPad.waveform = generateWaveform(decoded);
              await dbService.savePadConfig(config.id, mergedPad);
            }
            loadSampleToWorklet(mergedPad.sampleId!, decoded);
          } catch (e) {
            console.error(`Failed to restore sample ${mergedPad.sampleId}`, e);
          }
          newPads[config.id] = mergedPad;
        });

      await Promise.all(decodePromises);

      configs.forEach(config => {
        if (newPads[config.id] && !newPads[config.id].buffer) {
          newPads[config.id] = { ...newPads[config.id], ...config };
        }
      });

      set({ pads: newPads });
    }

    set({ isHydrating: false });
  },

  setChannel: (channel) => set({ currentChannel: channel }),
  selectPad: (index) => set({ selectedPadId: `pad-${index}` }),

  updatePad: (index, updates) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
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
    if (updates.cutoff !== undefined || updates.resonance !== undefined || updates.pitch !== undefined || updates.volume !== undefined || updates.pan !== undefined) {
      useAudioStore.getState().updatePadParams(id, {
        cutoff: updates.cutoff,
        resonance: updates.resonance,
        pitch: updates.pitch,
        volume: updates.volume,
        pan: updates.pan
      });
    }
  },

  toggleMute: (index) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
    const pad = pads[id];
    if (pad) {
      const updates = { mute: !pad.mute };
      set(state => ({ pads: { ...state.pads, [id]: { ...pad, ...updates } } }));
      dbService.savePadConfig(id, updates);
    }
  },

  toggleSolo: (index) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
    const pad = pads[id];
    if (pad) {
      const updates = { solo: !pad.solo };
      set(state => ({ pads: { ...state.pads, [id]: { ...pad, ...updates } } }));
      dbService.savePadConfig(id, updates);
    }
  },

  clearPad: (index) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
    const currentPad = pads[id];
    const basePads = createBasePads();
    const defaultPad = basePads[id];
    if (defaultPad) {
      if (currentPad?.sampleId) {
        useAudioStore.getState().removeSampleFromWorklet(currentPad.sampleId);
      }
      set(state => ({ pads: { ...state.pads, [id]: defaultPad } }));
      dbService.savePadConfig(id, defaultPad);
    }
  },

  loadSample: async (index, url, name) => {
    const { pads, currentChannel } = get();
    const { audioContext, loadSampleToWorklet } = useAudioStore.getState();
    if (!audioContext) return;

    try {
      const resp = await fetch(url);
      const originalArrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(originalArrayBuffer.slice(0));
      const sampleId = `${currentChannel}-${index}-${Date.now()}`;
      const waveform = generateWaveform(audioBuffer);
      loadSampleToWorklet(sampleId, audioBuffer);
      const id = `${currentChannel}-${index}`;

      const updatedPad: Pad = {
        ...pads[id],
        sampleId,
        sampleName: name,
        buffer: audioBuffer,
        waveform,
        start: 0,
        end: 1,
        viewStart: 0,
        viewEnd: 1,
        triggerMode: 'ONE_SHOT'
      };

      set(state => ({ pads: { ...state.pads, [id]: updatedPad } }));
      await dbService.saveSample({ id: sampleId, name: name, data: originalArrayBuffer, waveform });
      await dbService.savePadConfig(id, updatedPad);
    } catch (e) {
      console.error('Failed to load sample', e);
    }
  },

  triggerPad: (index, velocity = 1.0, pitchOverrideMultiplier = 1.0, startTime?: number, channelId?: ChannelId) => {
    const { pads, currentChannel } = get();
    const { triggerPad, audioContext } = useAudioStore.getState();
    const targetChannel = channelId || currentChannel;
    const id = `${targetChannel}-${index}`;
    const pad = pads[id];

    if (pad && pad.sampleId && pad.buffer && audioContext) {
      // Mute/Solo Logic
      if (pad.mute) return;

      const allPads = Object.values(pads);
      const anySoloed = allPads.some(p => p.solo);
      if (anySoloed && !pad.solo) return;

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

  stopPad: (index: number, startTime?: number, channelId?: ChannelId) => {
    const { pads, currentChannel } = get();
    const effectiveChannel = channelId || currentChannel;
    const id = `${effectiveChannel}-${index}`;
    const pad = pads[id];
    if (pad) {
      set(state => ({
        pads: {
          ...state.pads,
          [id]: { ...pad, isHeld: false }
        }
      }));
    }
    useAudioStore.getState().stopPad(id, startTime);
  },

  loadSamplePack: async (packId) => {
    set({ currentSamplePackId: packId });
    await dbService.saveMetadata('current_sample_pack_id', packId);
    await get().initPads(); // Re-initialize to fetch new library
  },

  addSamplePack: async (name, url) => {
    const id = `pack-${Date.now()}`;
    const newPack = { id, name, url };
    await dbService.saveSamplePack(newPack);
    const packs = await dbService.getAllSamplePacks();
    set({ samplePacks: packs });
  },

  deleteSamplePack: async (packId) => {
    if (packId === 'factory-default') return;
    await dbService.deleteSamplePack(packId);
    const packs = await dbService.getAllSamplePacks();
    set({ samplePacks: packs });
    if (get().currentSamplePackId === packId) {
      await get().loadSamplePack('factory-default');
    }
  },

  updateSamplePack: async (id, updates) => {
    const packs = get().samplePacks;
    const pack = packs.find(p => p.id === id);
    if (!pack) return;
    const updatedPack = { ...pack, ...updates };
    await dbService.saveSamplePack(updatedPack);
    const newPacks = await dbService.getAllSamplePacks();
    set({ samplePacks: newPacks });
  },

  resetAllPads: () => {
    const { pads } = get();
    const newPads = { ...pads };
    Object.keys(newPads).forEach(id => {
      newPads[id] = { ...newPads[id], isHeld: false, lastTriggerTime: undefined };
    });
    set({ pads: newPads });
  }
}));
