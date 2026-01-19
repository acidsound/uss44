
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
    const { initPads, resetPads } = usePadStore.getState();
    const { initSequencer, resetSequencer } = useSequencerStore.getState();

    // Clear Active State DB (Sets, Pads, Sequences)
    await dbService.clearAllData();

    // Reset Stores to clean state
    resetPads();
    resetSequencer(true);

    // Re-initialize to trigger default sample loading
    await initPads();
    await initSequencer();
  }

  async clearSong(): Promise<void> {
    await dbService.clearAllData();
    usePadStore.getState().resetPads();
    useSequencerStore.getState().resetSequencer();
  }

  async clearSound(): Promise<void> {
    await dbService.clearSoundKit();
    usePadStore.getState().resetPads();
  }

  async clearSequence(): Promise<void> {
    await dbService.clearSequences();
    useSequencerStore.getState().resetSequencer();
  }

  // --- SERIALIZATION HELPERS ---

  private serializePadsAndSamples() {
    const { pads, samples } = usePadStore.getState();
    const result: { pads: Record<string, any>, samples: Record<string, any> } = { pads: {}, samples: {} };

    for (const key in pads) {
      const pad = pads[key];
      const { buffer, isHeld, lastTriggerTime, lastTriggerDuration, ...persistPad } = pad;
      result.pads[key] = persistPad;

      if (pad.sampleId && pad.buffer) {
        if (!result.samples[pad.sampleId]) {
          const data = pad.buffer.getChannelData(0);
          const base64 = float32ToBase64(data);
          const sampleMeta = samples[pad.sampleId];
          result.samples[pad.sampleId] = {
            name: sampleMeta?.name || 'Untitled',
            dataBase64: base64,
            waveform: sampleMeta?.waveform || []
          };
        }
      }
    }
    return result;
  }

  private serializeAll(): ProjectData {
    const { patterns, bpm, stepCount } = useSequencerStore.getState();
    const soundData = this.serializePadsAndSamples();

    return {
      version: 1,
      date: Date.now(),
      pads: soundData.pads,
      samples: soundData.samples,
      patterns: patterns,
      stepCount: stepCount,
      bpm: bpm
    };
  }

  private async deserializePadsAndSamples(data: { pads: any, samples: any }) {
    const { audioContext, loadSampleToWorklet } = useAudioStore.getState();

    if (!audioContext) throw new Error("Audio Engine not initialized");

    const restoredBuffers = new Map<string, AudioBuffer>();
    const restoredSamples: Record<string, { name: string, waveform: number[] }> = {};

    for (const sampleId in data.samples) {
      const s = data.samples[sampleId];
      const float32 = base64ToFloat32(s.dataBase64);

      const buffer = audioContext.createBuffer(1, float32.length, audioContext.sampleRate);
      buffer.copyToChannel(float32 as any, 0);

      restoredBuffers.set(sampleId, buffer);
      restoredSamples[sampleId] = { name: s.name, waveform: s.waveform || [] };
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
      await dbService.savePadConfig(key, pad);
    }

    // Update store with both pads and sample metadata
    usePadStore.setState({ pads: newPads, samples: restoredSamples });
  }

  // --- INDIVIDUAL FILE EXPORT/IMPORT ---

  async importFileToLibrary(file: File): Promise<{ type: LibraryType, name: string }> {
    const text = await file.text();
    const json = JSON.parse(text);

    if (json.appName !== 'USS44' || !json.type || !json.data) {
      throw new Error("Invalid USS44 file format");
    }

    const type = json.type as LibraryType;
    const name = json.name || file.name.split('.')[0];

    await dbService.saveToLibrary(STORES[type], name, json.data);
    return { type, name };
  }

  async importAndLoadFile(file: File): Promise<void> {
    const text = await file.text();
    const json = JSON.parse(text);

    if (json.appName !== 'USS44' || !json.type || !json.data) {
      // Fallback for old "Project" format (Import All)
      if (json.pads && json.samples && json.patterns) {
        await this.importAll(file);
        return;
      }
      throw new Error("Invalid USS44 file format");
    }

    const type = json.type as LibraryType;
    await this.loadLibraryItem(type, json.name, json.data);
  }

  async exportLibraryItem(type: LibraryType, name: string): Promise<void> {
    const data = await dbService.loadFromLibrary(STORES[type], name);
    if (!data) throw new Error("Item not found");

    const exportData = {
      appName: 'USS44',
      version: 1,
      type,
      name,
      data
    };

    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `USS44_${type}_${name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportCurrentItem(type: LibraryType): Promise<void> {
    let data: any;
    let defaultName = 'Untitled';

    if (type === 'SOUND') {
      data = this.serializePadsAndSamples();
      defaultName = 'Current_Sound';
    } else if (type === 'SEQUENCE') {
      const { patterns, stepCount, bpm } = useSequencerStore.getState();
      data = { patterns, stepCount, bpm };
      defaultName = 'Current_Sequence';
    } else if (type === 'SONG') {
      data = this.serializeAll();
      defaultName = 'Current_Song';
    }

    const exportData = {
      appName: 'USS44',
      version: 1,
      type,
      name: defaultName,
      data
    };

    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `USS44_${type}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      data = this.serializeAll();
    } else if (type === 'SOUND') {
      data = this.serializePadsAndSamples();
    } else if (type === 'SEQUENCE') {
      const { patterns, stepCount, bpm } = useSequencerStore.getState();
      data = { patterns, stepCount, bpm };
    }

    await dbService.saveToLibrary(STORES[type], name, data);
  }

  async loadLibraryItem(type: LibraryType, name: string, directData?: any) {
    const data = directData || await dbService.loadFromLibrary(STORES[type], name);
    if (!data) throw new Error("File not found");

    if (type === 'SONG') {
      await this.initAll();
      await this.deserializePadsAndSamples(data);
      const { setPatterns, setBpm, setStepCount } = useSequencerStore.getState();
      setPatterns(data.patterns);
      setBpm(data.bpm);
      if (data.stepCount) setStepCount(data.stepCount);
      await dbService.saveMetadata('bpm', data.bpm);
      for (const key in data.patterns) {
        await dbService.saveSequence(key, data.patterns[key]);
      }
    } else if (type === 'SOUND') {
      // Clear only sounds? Or just overwrite?
      const { resetPads } = usePadStore.getState();
      resetPads();
      await this.deserializePadsAndSamples(data);
    } else if (type === 'SEQUENCE') {
      const { resetSequencer, setPatterns, setBpm, setStepCount } = useSequencerStore.getState();
      resetSequencer();
      setPatterns(data.patterns);
      setBpm(data.bpm);
      if (data.stepCount) setStepCount(data.stepCount);
      await dbService.saveMetadata('bpm', data.bpm);
      await dbService.clearSequences();
      for (const key in data.patterns) {
        await dbService.saveSequence(key, data.patterns[key]);
      }
    }
  }

  // --- FILE EXPORT/IMPORT (JSON) ---

  async exportAll(): Promise<void> {
    const projectData = this.serializeAll();

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

    const { setPatterns, setBpm, setStepCount } = useSequencerStore.getState();
    setPatterns(data.patterns);
    setBpm(data.bpm);
    if (data.stepCount) setStepCount(data.stepCount);
    await dbService.saveMetadata('bpm', data.bpm);
    for (const key in data.patterns) {
      await dbService.saveSequence(key, data.patterns[key]);
    }
  }
}

export const projectService = new ProjectService();
