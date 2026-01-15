
import { usePadStore } from '../stores/padStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { useAudioStore } from '../stores/audioStore';
import { dbService } from './dbService';
import { ProjectData, Pad, StepData } from '../types';

export type LibraryType = 'SONG' | 'SOUND' | 'SEQUENCE';

const STORES = {
  SONG: 'user_songs',
  SOUND: 'user_sounds',
  SEQUENCE: 'user_sequences'
};

// Helper to convert Float32Array to Base64 (via Uint8Array view of buffer)
const float32ToBase64 = (float32: Float32Array): string => {
  const uint8 = new Uint8Array(float32.buffer);
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
};

// Helper to convert Base64 back to Float32Array
const base64ToFloat32 = (base64: string): Float32Array => {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer as ArrayBuffer);
};

class ProjectService {

  async initAll(): Promise<void> {
    const { resetPads } = usePadStore.getState();
    const { resetSequencer } = useSequencerStore.getState();

    // Clear Active State DB
    await dbService.clearAllData();

    // Reset Stores
    resetPads();
    resetSequencer();
  }

  // --- SERIALIZATION HELPERS ---

  private serializePadsAndSamples() {
    const { pads } = usePadStore.getState();
    const result: { pads: Record<string, any>, samples: Record<string, any> } = { pads: {}, samples: {} };

    for (const key in pads) {
      const pad = pads[key];
      const { buffer, isHeld, lastTriggerTime, lastTriggerDuration, ...persistPad } = pad;
      result.pads[key] = persistPad;

      if (pad.sampleId && pad.buffer) {
        if (!result.samples[pad.sampleId]) {
          const data = pad.buffer.getChannelData(0);
          const base64 = float32ToBase64(data);
          result.samples[pad.sampleId] = {
            name: pad.sampleName || 'Untitled',
            dataBase64: base64,
            waveform: pad.waveform || []
          };
        }
      }
    }
    return result;
  }

  private async deserializePadsAndSamples(data: { pads: any, samples: any }) {
    const { audioContext, loadSampleToWorklet } = useAudioStore.getState();
    const { setPadsFromData } = usePadStore.getState();

    if (!audioContext) throw new Error("Audio Engine not initialized");

    const restoredBuffers = new Map<string, AudioBuffer>();

    for (const sampleId in data.samples) {
      const s = data.samples[sampleId];
      const float32 = base64ToFloat32(s.dataBase64);

      const buffer = audioContext.createBuffer(1, float32.length, audioContext.sampleRate);
      buffer.copyToChannel(float32 as any, 0);

      restoredBuffers.set(sampleId, buffer);
      loadSampleToWorklet(sampleId, buffer);

      // Persist to system cache
      await dbService.saveSample({
        id: sampleId,
        name: s.name,
        data: float32.buffer as ArrayBuffer,
        waveform: s.waveform
      });
    }

    const newPads: Record<string, Pad> = {};
    for (const key in data.pads) {
      const pData = data.pads[key];
      const pad: Pad = {
        ...pData,
        buffer: pData.sampleId ? restoredBuffers.get(pData.sampleId) : undefined,
        isHeld: false
      };
      newPads[key] = pad;
      // Key here is "A-0", "B-0" etc. pad.id is just "pad-0"
      await dbService.savePadConfig(key, pad);
    }
    setPadsFromData(newPads);
  }

  // --- LIBRARY MANAGEMENT ---

  async listLibrary(type: LibraryType) {
    await dbService.init();
    return dbService.listLibrary(STORES[type]);
  }

  async deleteLibraryItem(type: LibraryType, name: string) {
    await dbService.deleteFromLibrary(STORES[type], name);
  }

  async renameLibraryItem(type: LibraryType, oldName: string, newName: string) {
    await dbService.renameInLibrary(STORES[type], oldName, newName);
  }

  async saveLibraryItem(type: LibraryType, name: string) {
    let data;
    if (type === 'SONG') {
      const { patterns, bpm } = useSequencerStore.getState();
      const soundData = this.serializePadsAndSamples();
      data = {
        version: 1,
        date: Date.now(),
        pads: soundData.pads,
        samples: soundData.samples,
        patterns,
        bpm
      };
    } else if (type === 'SOUND') {
      data = this.serializePadsAndSamples();
    } else if (type === 'SEQUENCE') {
      const { patterns, bpm } = useSequencerStore.getState();
      data = { patterns, bpm };
    }

    await dbService.saveToLibrary(STORES[type], name, data);
  }

  async loadLibraryItem(type: LibraryType, name: string) {
    const data = await dbService.loadFromLibrary(STORES[type], name);
    if (!data) throw new Error("File not found");

    if (type === 'SONG') {
      await this.initAll();
      await this.deserializePadsAndSamples(data);
      const { setPatterns, setBpm } = useSequencerStore.getState();
      setPatterns(data.patterns);
      setBpm(data.bpm);
      await dbService.saveMetadata('bpm', data.bpm);
      for (const key in data.patterns) {
        await dbService.saveSequence(key, data.patterns[key]);
      }
    } else if (type === 'SOUND') {
      // Clear only sounds? Or just overwrite?
      // Usually load sound replaces the sound engine state
      const { resetPads } = usePadStore.getState();
      resetPads();
      await this.deserializePadsAndSamples(data);
    } else if (type === 'SEQUENCE') {
      const { resetSequencer, setPatterns, setBpm } = useSequencerStore.getState();
      resetSequencer();
      setPatterns(data.patterns);
      setBpm(data.bpm);
      await dbService.saveMetadata('bpm', data.bpm);
      await dbService.clearSequences();
      for (const key in data.patterns) {
        await dbService.saveSequence(key, data.patterns[key]);
      }
    }
  }

  // --- FILE EXPORT/IMPORT (JSON) ---

  async exportAll(): Promise<void> {
    const { patterns, bpm } = useSequencerStore.getState();
    const soundData = this.serializePadsAndSamples();

    const projectData: ProjectData = {
      version: 1,
      date: Date.now(),
      pads: soundData.pads,
      samples: soundData.samples,
      patterns: patterns,
      bpm: bpm
    };

    const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `USS44_Project_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importAll(file: File): Promise<void> {
    const text = await file.text();
    const data: ProjectData = JSON.parse(text);

    await this.initAll();
    await this.deserializePadsAndSamples({ pads: data.pads, samples: data.samples });

    const { setPatterns, setBpm } = useSequencerStore.getState();
    setPatterns(data.patterns);
    setBpm(data.bpm);
    await dbService.saveMetadata('bpm', data.bpm);
    for (const key in data.patterns) {
      await dbService.saveSequence(key, data.patterns[key]);
    }
  }
}

export const projectService = new ProjectService();
