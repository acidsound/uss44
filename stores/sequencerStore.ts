
import { create } from 'zustand';
import { STEPS_PER_BAR } from '../constants';
import { StepData } from '../types';
import { dbService } from '../services/dbService';

interface SequencerState {
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  selectedStepIndex: number; // The step currently being edited in SEQUENCE mode
  patterns: Record<string, StepData[]>; // Key: "Channel-PadIndex" (e.g. "A-0")

  setBpm: (bpm: number) => void;
  togglePlay: () => void;
  setStep: (step: number) => void;
  setSelectedStepIndex: (index: number) => void;
  toggleStep: (channel: string, padIndex: number, stepIndex: number) => void;
  updateStepData: (channel: string, padIndex: number, stepIndex: number, updates: Partial<StepData>) => void;

  initSequencer: () => Promise<void>;
  resetSequencer: () => void;
  setPatterns: (patterns: Record<string, StepData[]>) => void;
}

const createDefaultStep = (): StepData => ({
  active: false,
  velocity: 127,
  pitch: 0,
  length: 1.0,
});

export const useSequencerStore = create<SequencerState>((set, get) => ({
  bpm: 110,
  isPlaying: false,
  currentStep: -1,
  selectedStepIndex: 0,
  patterns: {},

  initSequencer: async () => {
    await dbService.init();
    const storedSequences = await dbService.getAllSequences();
    if (storedSequences.length > 0) {
      const patterns: Record<string, StepData[]> = {};
      storedSequences.forEach(seq => {
        patterns[seq.id] = seq.steps;
      });
      set({ patterns });
    }
    const storedBpm = await dbService.getMetadata('bpm');
    if (storedBpm) set({ bpm: storedBpm });
  },

  resetSequencer: () => {
    set({ patterns: {}, currentStep: -1, bpm: 110 });
    dbService.saveMetadata('bpm', 110);
  },

  setPatterns: (patterns) => {
    set({ patterns });
  },

  setBpm: (bpm) => {
    set({ bpm });
    dbService.saveMetadata('bpm', bpm);
  },

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setStep: (step) => set({ currentStep: step }),

  setSelectedStepIndex: (index) => set({ selectedStepIndex: index }),

  toggleStep: (channel, padIndex, stepIndex) => {
    const key = `${channel}-${padIndex}`;
    const { patterns } = get();
    const track = patterns[key] || Array.from({ length: STEPS_PER_BAR }, createDefaultStep);
    const newTrack = track.map((s, i) => i === stepIndex ? { ...s, active: !s.active } : s);

    set({ patterns: { ...patterns, [key]: newTrack } });
    dbService.saveSequence(key, newTrack);
  },

  updateStepData: (channel, padIndex, stepIndex, updates) => {
    const key = `${channel}-${padIndex}`;
    const { patterns } = get();
    const track = patterns[key] || Array.from({ length: STEPS_PER_BAR }, createDefaultStep);
    const newTrack = track.map((s, i) => i === stepIndex ? { ...s, ...updates } : s);

    set({ patterns: { ...patterns, [key]: newTrack } });
    dbService.saveSequence(key, newTrack);
  }
}));
