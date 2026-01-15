
export type ChannelId = 'A' | 'B' | 'C' | 'D';
export type TriggerMode = 'GATE' | 'ONE_SHOT' | 'LOOP';

export interface Envelope {
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // 0-1
  release: number; // seconds
}

export interface SampleMetadata {
  name: string;
  bank: string;
  url: string;
  id: string; // unique string for browser
  waveform?: number[]; // Array of peaks for visualization
}

export interface Sample {
  id: string; // Internal ID (e.g., 'pad-A-0')
  name: string;
  url?: string;
  loaded: boolean;
  duration: number;
  buffer?: AudioBuffer;
}

export interface Pad {
  id: string; // 'pad-0' to 'pad-15' (visual index)
  channelId: ChannelId;
  sampleId: string | null;
  sampleName?: string; // The user-editable name for the sample on this pad

  // Parameters
  volume: number;      // 0-2
  pitch: number;       // playbackRate (0.1 - 4.0)
  pan: number;         // -1 to 1
  cutoff: number;      // Hz (Displayed as kHz in UI)
  resonance: number;   // 0-20 (Q)
  start: number;       // 0-1
  end: number;         // 0-1
  envelope: Envelope;
  triggerMode: TriggerMode;

  // View/Zoom state
  viewStart: number;   // 0-1 (for waveform zoom persistence)
  viewEnd: number;     // 0-1 (for waveform zoom persistence)

  color: string;
  buffer?: AudioBuffer;
  waveform?: number[]; // Pre-computed peaks for immediate UI feedback

  // Transient trigger data for UI feedback
  lastTriggerTime?: number;
  lastTriggerDuration?: number;
  isHeld?: boolean; // Track if the pad is currently pressed/held
  mute?: boolean;
  solo?: boolean;
}

export interface StepData {
  active: boolean;
  velocity: number; // 0-127
  pitch: number;    // semitones relative to pad pitch (-24 to +24)
  length: number;   // duration factor (0.1 to 4.0)
}

export interface DigItem {
  id: string;
  type: 'video' | 'audio';
  thumbnail: string;
  title: string;
  duration: string;
  audioUrl: string;
  waveform?: number[];
}

export enum AppMode {
  PERFORM = 'PERFORM',
  SEQUENCE = 'SEQUENCE',
  SAMPLE = 'SAMPLE', // Renamed from DIG
  EDIT = 'EDIT'
}

export interface ProjectData {
  version: number;
  date: number;
  pads: Record<string, Omit<Pad, 'buffer' | 'isHeld' | 'lastTriggerTime' | 'lastTriggerDuration'>>;
  samples: Record<string, { name: string, dataBase64: string, waveform: number[] }>;
  patterns: Record<string, StepData[]>;
  bpm: number;
}

export interface SamplePack {
  id: string;
  name: string;
  url: string;
  isDefault?: boolean;
}
