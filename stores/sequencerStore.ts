
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

  // State to track last modified step settings
  lastStepSettings: Omit<StepData, 'active'>;

  // Actions
  setBpm: (bpm: number) => void;
  togglePlay: () => void;
  setStep: (step: number) => void;
  setSelectedStepIndex: (index: number) => void;
  toggleStep: (channel: string, padIndex: number, stepIndex: number) => void;
  updateStepData: (channel: string, padIndex: number, stepIndex: number, updates: Partial<StepData>) => void;
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  recordHit: (channel: string, padIndex: number, velocity?: number) => void;

  stepCount: number;
  setStepCount: (count: number) => void;

  initSequencer: () => Promise<void>;
  resetSequencer: (fullReset?: boolean) => void;
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
  stepCount: 16,
  patterns: {},
  isRecording: false,

  // Default last settings
  lastStepSettings: {
    velocity: 127,
    pitch: 0,
    length: 1.0
  },

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

    // Load step count
    const storedStepCount = await dbService.getMetadata('stepCount');
    if (storedStepCount && (storedStepCount === 16 || storedStepCount === 64)) {
      set({ stepCount: storedStepCount });
    }
  },

  resetSequencer: (fullReset = false) => {
    if (fullReset) {
      set({ patterns: {}, currentStep: -1, bpm: 110, stepCount: 16 });
      dbService.saveMetadata('bpm', 110);
      dbService.saveMetadata('stepCount', 16);
    } else {
      set({ patterns: {}, currentStep: -1 });
    }
  },

  setPatterns: (patterns) => {
    set({ patterns });
  },

  setBpm: (bpm) => {
    set({ bpm });
    dbService.saveMetadata('bpm', bpm);
  },

  setStepCount: (stepCount) => {
    set({ stepCount });
    dbService.saveMetadata('stepCount', stepCount);
  },

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setStep: (step) => set({ currentStep: step }),

  setSelectedStepIndex: (index) => set({ selectedStepIndex: index }),

  toggleStep: (channel, padIndex, stepIndex) => {
    const key = `${channel}-${padIndex}`;
    const { patterns, stepCount, lastStepSettings } = get();

    // Ensure track exists and is long enough
    let track = patterns[key] ? [...patterns[key]] : [];
    const neededLength = Math.max(stepCount, stepIndex + 1);

    if (track.length < neededLength) {
      const missing = neededLength - track.length;
      track = [...track, ...Array.from({ length: missing }, createDefaultStep)];
    }

    // Toggle logic
    const willBeActive = !track[stepIndex].active;

    // If activating, apply last used settings
    if (willBeActive) {
      track[stepIndex] = {
        ...track[stepIndex],
        active: true,
        ...lastStepSettings
      };
    } else {
      track[stepIndex] = { ...track[stepIndex], active: false };
    }

    set({ patterns: { ...patterns, [key]: track } });
    dbService.saveSequence(key, track);
  },

  updateStepData: (channel, padIndex, stepIndex, updates) => {
    const key = `${channel}-${padIndex}`;
    const { patterns, stepCount, lastStepSettings } = get();

    let track = patterns[key] ? [...patterns[key]] : [];
    const neededLength = Math.max(stepCount, stepIndex + 1);

    if (track.length < neededLength) {
      const missing = neededLength - track.length;
      track = [...track, ...Array.from({ length: missing }, createDefaultStep)];
    }

    track[stepIndex] = { ...track[stepIndex], ...updates };

    // Update lastStepSettings if relevant fields are changed
    const newSettings = { ...lastStepSettings };
    let hasChanges = false;

    if (updates.velocity !== undefined) { newSettings.velocity = updates.velocity; hasChanges = true; }
    if (updates.pitch !== undefined) { newSettings.pitch = updates.pitch; hasChanges = true; }
    if (updates.length !== undefined) { newSettings.length = updates.length; hasChanges = true; }

    if (hasChanges) {
      set({
        patterns: { ...patterns, [key]: track },
        lastStepSettings: newSettings
      });
    } else {
      set({ patterns: { ...patterns, [key]: track } });
    }

    dbService.saveSequence(key, track);
  },

  setIsRecording: (isRecording) => set({ isRecording }),

  recordHit: (channel, padIndex, velocity = 127) => {
    const { isPlaying, isRecording, currentStep, patterns, stepCount, lastStepSettings } = get();
    if (!isPlaying || !isRecording || currentStep < 0) return;

    const key = `${channel}-${padIndex}`;
    let track = patterns[key] ? [...patterns[key]] : [];

    // Ensure track length
    if (track.length < stepCount) {
      const missing = stepCount - track.length;
      track = [...track, ...Array.from({ length: missing }, createDefaultStep)];
    }

    // Record the hit at currentStep
    track[currentStep] = {
      ...track[currentStep],
      active: true,
      velocity: velocity,
      pitch: lastStepSettings.pitch, // Use last used pitch
      length: lastStepSettings.length // Use last used length
    };

    set({ patterns: { ...patterns, [key]: track } });
    dbService.saveSequence(key, track);
  }
}));
