
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
  samples: Record<string, { name: string, waveform: number[] }>; // Runtime cache for sample data

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
  syncMuteStates: () => void;
  clearPad: (index: number) => void;
  updateSampleName: (sampleId: string, newName: string) => Promise<void>;

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

  // Clone functionality
  isCloneMode: boolean;
  sourcePadId: string | null;
  setCloneMode: (sourcePadId: string | null) => void;
  executeClone: (targetPadIndex: number) => void;
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
  samples: {},
  samplePacks: [],
  currentSamplePackId: 'factory-default',
  isCloneMode: false,
  sourcePadId: null,

  resetPads: () => {
    set({ pads: createBasePads(), samples: {} });
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

    // Populate the runtime samples cache
    const sampleCache: Record<string, { name: string, waveform: number[] }> = {};
    storedSamples.forEach(s => {
      sampleCache[s.id] = { name: s.name, waveform: s.waveform || [] };
    });
    set({ samples: sampleCache });

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
            const currentSample = sampleCache[mergedPad.sampleId!];
            if (!currentSample?.waveform || currentSample.waveform.length === 0) {
              const waveform = generateWaveform(decoded);
              sampleCache[mergedPad.sampleId!] = { ...currentSample, waveform };
              await dbService.saveSample({ ...stored, waveform });
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

      set({ pads: newPads, samples: { ...sampleCache } });
    }

    get().syncMuteStates();
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

    if (updates.mute !== undefined || updates.solo !== undefined) {
      get().syncMuteStates();
    }
  },

  syncMuteStates: () => {
    const { pads } = get();
    const allPads = Object.values(pads);
    const anySoloed = allPads.some(p => p.solo);

    Object.keys(pads).forEach(id => {
      const pad = pads[id];
      const effectivelyMuted = pad.mute || (anySoloed && !pad.solo);
      useAudioStore.getState().updatePadParams(id, { mute: effectivelyMuted });
    });
  },

  toggleMute: (index) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
    const pad = pads[id];
    if (pad) {
      const updates = { mute: !pad.mute };
      const newPads = { ...pads, [id]: { ...pad, ...updates } };
      set({ pads: newPads });
      dbService.savePadConfig(id, updates);
      get().syncMuteStates();
    }
  },

  toggleSolo: (index) => {
    const { pads, currentChannel } = get();
    const id = `${currentChannel}-${index}`;
    const pad = pads[id];
    if (pad) {
      const updates = { solo: !pad.solo };
      const newPads = { ...pads, [id]: { ...pad, ...updates } };
      set({ pads: newPads });
      dbService.savePadConfig(id, updates);
      get().syncMuteStates();
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
        // Only remove from worklet if no other pads are using this sampleId
        const otherPadsUsingSample = Object.values(pads).filter(p => p.id !== id && p.sampleId === currentPad.sampleId);
        if (otherPadsUsingSample.length === 0) {
          useAudioStore.getState().removeSampleFromWorklet(currentPad.sampleId);
        }
      }
      set(state => ({ pads: { ...state.pads, [id]: defaultPad } }));
      dbService.savePadConfig(id, defaultPad);
      get().syncMuteStates();
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
        buffer: audioBuffer,
        start: 0,
        end: 1,
        viewStart: 0,
        viewEnd: 1,
        triggerMode: 'ONE_SHOT'
      };

      set(state => ({
        pads: { ...state.pads, [id]: updatedPad },
        samples: { ...state.samples, [sampleId]: { name, waveform } }
      }));
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
        mute: false, // Already checked above, shouldn't trigger if effectively muted
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
  },

  updateSampleName: async (sampleId, newName) => {
    const { samples } = get();
    if (!samples[sampleId]) return;

    // Update runtime cache
    const updatedSamples = { ...samples, [sampleId]: { ...samples[sampleId], name: newName } };
    set({ samples: updatedSamples });

    // Persist to IndexedDB
    const storedSamples = await dbService.getAllSamples();
    const stored = storedSamples.find(s => s.id === sampleId);
    if (stored) {
      await dbService.saveSample({ ...stored, name: newName });
    }
  },

  setCloneMode: (sourcePadId) => set({ isCloneMode: !!sourcePadId, sourcePadId }),

  executeClone: (targetPadIndex) => {
    const { pads, sourcePadId, currentChannel, updatePad, selectPad } = get();
    if (!sourcePadId) {
      set({ isCloneMode: false, sourcePadId: null });
      return;
    }

    const targetPadId = `${currentChannel}-${targetPadIndex}`;
    if (sourcePadId === targetPadId) {
      set({ isCloneMode: false, sourcePadId: null });
      return;
    }

    const sourcePad = pads[sourcePadId];
    if (!sourcePad) {
      set({ isCloneMode: false, sourcePadId: null });
      return;
    }

    // Clone configuration
    // We update the target pad with source pad's values
    // Note: updatePad already handles persistence and worklet updates
    updatePad(targetPadIndex, {
      sampleId: sourcePad.sampleId,
      buffer: sourcePad.buffer,
      volume: sourcePad.volume,
      pitch: sourcePad.pitch,
      pan: sourcePad.pan,
      cutoff: sourcePad.cutoff,
      resonance: sourcePad.resonance,
      start: sourcePad.start,
      end: sourcePad.end,
      viewStart: sourcePad.viewStart,
      viewEnd: sourcePad.viewEnd,
      envelope: { ...sourcePad.envelope },
      triggerMode: sourcePad.triggerMode,
      // Keep target pad's original color if preferred, or copy? User said "clone pad", usually means everything.
      // Keeping original color might be better for grid identification, but user said " 그대로 복사".
      // Let's copy color too.
      color: sourcePad.color,
    });

    selectPad(targetPadIndex);
    set({ isCloneMode: false, sourcePadId: null });
  }
}));
