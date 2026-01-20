
import { create } from 'zustand';
import { STEPS_PER_BAR } from '../constants';
import { StepData, Pattern, SongItem } from '../types';
import { dbService } from '../services/dbService';

interface SequencerState {
  bpm: number;
  isPlaying: boolean;
  currentStep: number;
  selectedStepIndex: number;
  stepCount: number;

  // Runtime State (Buffer)
  patterns: Record<string, StepData[]>; // Currently active tracks for rendering

  // Library & Song State
  patternLibrary: Record<string, Pattern>;
  song: SongItem[];
  activePatternId: string; // e.g., 'ptn-0'
  isSongMode: boolean;
  songIndex: number;
  selectedSongIndex: number;

  lastStepSettings: Omit<StepData, 'active'>;
  isRecording: boolean;

  // Actions
  setBpm: (bpm: number) => void;
  togglePlay: () => void;
  setStep: (step: number) => void;
  setStepCount: (count: number) => void;
  setSelectedStepIndex: (index: number) => void;

  // Track Actions
  toggleStep: (channel: string, padIndex: number, stepIndex: number) => void;
  updateStepData: (channel: string, padIndex: number, stepIndex: number, updates: Partial<StepData>) => void;
  setPatterns: (patterns: Record<string, StepData[]>) => void;
  setIsRecording: (rec: boolean) => void;
  recordHit: (channel: string, padIndex: number, velocity?: number) => void;

  // Song/Pattern Actions
  initSequencer: () => Promise<void>;
  resetSequencer: (fullReset?: boolean) => void;

  setActivePatternId: (id: string) => void;
  createPattern: (id: string) => void;
  setIsSongMode: (enabled: boolean) => void;
  setSong: (song: SongItem[]) => void;
  addToSong: (patternId: string) => void;
  insertIntoSong: (patternId: string, afterIndex: number) => void;
  setSelectedSongIndex: (index: number) => void;
  removeFromSong: (index: number) => void;
  advanceSong: () => void;
  cyclePattern: () => void;
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

  // Runtime Active State
  patterns: {},

  // Library State
  patternLibrary: {},
  song: [],
  activePatternId: 'ptn-0', // Default to Pattern A
  isSongMode: false,
  songIndex: 0,
  selectedSongIndex: -1,

  isRecording: false,

  // Default last settings
  lastStepSettings: {
    velocity: 127,
    pitch: 0,
    length: 1.0
  },

  initSequencer: async () => {
    await dbService.init();

    // Load Patterns
    const storedPatterns = await dbService.getAllPatterns();
    const storedSong = await dbService.getSong();

    let patternLibrary: Record<string, Pattern> = {};

    if (storedPatterns.length > 0) {
      storedPatterns.forEach(p => {
        if (p && p.id && !p.id.startsWith('__metadata_')) {
          patternLibrary[p.id] = p;
        }
      });
    }

    // Ensure we have at least Pattern A
    if (Object.keys(patternLibrary).length === 0) {
      const defaultPattern: Pattern = {
        id: 'ptn-0',
        name: 'Pattern A',
        tracks: {},
        stepCount: 16
      };
      patternLibrary['ptn-0'] = defaultPattern;
      await dbService.savePattern(defaultPattern);
    }

    set({ patternLibrary, song: storedSong });

    // Load Metadata
    const storedBpm = await dbService.getMetadata('bpm');
    if (storedBpm) set({ bpm: storedBpm });

    const storedStepCount = await dbService.getMetadata('stepCount');
    if (storedStepCount && (storedStepCount === 16 || storedStepCount === 64)) {
      set({ stepCount: storedStepCount });
    } else {
      // Fallback to pattern step count (with safety check)
      const firstPattern = patternLibrary['ptn-0'] || Object.values(patternLibrary)[0];
      set({ stepCount: firstPattern?.stepCount || 16 });
    }

    // Initialize Active Pattern (Load Pattern A or first available)
    const activeId = 'ptn-0';
    const activePattern = patternLibrary[activeId] || Object.values(patternLibrary)[0];

    if (activePattern) {
      set({
        activePatternId: activePattern.id,
        patterns: activePattern.tracks,
        stepCount: activePattern.stepCount
      });
    }
  },

  resetSequencer: (fullReset = false) => {
    if (fullReset) {
      const defaultPattern: Pattern = {
        id: 'ptn-0',
        name: 'Pattern A',
        tracks: {},
        stepCount: 16
      };
      set({
        patterns: {},
        patternLibrary: { 'ptn-0': defaultPattern },
        song: [],
        currentStep: -1,
        bpm: 110,
        stepCount: 16,
        activePatternId: 'ptn-0',
        isSongMode: false,
        songIndex: 0,
        selectedSongIndex: -1
      });
      dbService.saveMetadata('bpm', 110);
      dbService.saveMetadata('stepCount', 16);
      dbService.clearPatterns();
      dbService.savePattern(defaultPattern);
      dbService.saveSong([]);
    } else {
      set({ patterns: {}, currentStep: -1 });
    }
  },

  setPatterns: (patterns) => {
    // Updates current active pattern in library too
    const { activePatternId, patternLibrary } = get();
    const updatedPattern = { ...patternLibrary[activePatternId], tracks: patterns };

    const newLibrary = { ...patternLibrary, [activePatternId]: updatedPattern };

    set({ patterns, patternLibrary: newLibrary });
    dbService.savePattern(updatedPattern);
  },

  setBpm: (bpm) => {
    set({ bpm });
    dbService.saveMetadata('bpm', bpm);
  },

  setStepCount: (stepCount) => {
    set({ stepCount });
    // Also update current active pattern
    const { activePatternId, patternLibrary } = get();
    const updatedPattern = { ...patternLibrary[activePatternId], stepCount };
    set({ patternLibrary: { ...patternLibrary, [activePatternId]: updatedPattern } });
    dbService.savePattern(updatedPattern);
    dbService.saveMetadata('stepCount', stepCount);
  },

  togglePlay: () => set(state => {
    const nextIsPlaying = !state.isPlaying;
    const updates: Partial<SequencerState> = { isPlaying: nextIsPlaying };

    if (nextIsPlaying && state.isSongMode) {
      // Start from selection
      const startIdx = state.selectedSongIndex >= 0 ? state.selectedSongIndex : 0;
      updates.songIndex = startIdx;

      // Sync playback buffer to the starting pattern
      if (state.song[startIdx]) {
        const item = state.song[startIdx];
        const pattern = state.patternLibrary[item.patternId];
        if (pattern) {
          updates.activePatternId = pattern.id;
          updates.patterns = pattern.tracks;
          updates.stepCount = pattern.stepCount;
        }
      }
    }

    return updates;
  }),

  setStep: (step) => set({ currentStep: step }),

  setSelectedStepIndex: (index) => set({ selectedStepIndex: index }),

  toggleStep: (channel, padIndex, stepIndex) => {
    const key = `${channel}-${padIndex}`;
    const { patterns, stepCount, lastStepSettings, activePatternId, patternLibrary } = get();

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

    const newPatterns = { ...patterns, [key]: track };
    const updatedPattern = { ...patternLibrary[activePatternId], tracks: newPatterns };
    const newLibrary = { ...patternLibrary, [activePatternId]: updatedPattern };

    set({ patterns: newPatterns, patternLibrary: newLibrary });
    dbService.savePattern(updatedPattern);
  },

  updateStepData: (channel, padIndex, stepIndex, updates) => {
    const key = `${channel}-${padIndex}`;
    const { patterns, stepCount, lastStepSettings, activePatternId, patternLibrary } = get();

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

    const newPatterns = { ...patterns, [key]: track };
    const updatedPattern = { ...patternLibrary[activePatternId], tracks: newPatterns };
    const newLibrary = { ...patternLibrary, [activePatternId]: updatedPattern };

    if (hasChanges) {
      set({
        patterns: newPatterns,
        patternLibrary: newLibrary,
        lastStepSettings: newSettings
      });
    } else {
      set({ patterns: newPatterns, patternLibrary: newLibrary });
    }

    dbService.savePattern(updatedPattern);
  },

  setIsRecording: (isRecording) => set({ isRecording }),

  recordHit: (channel, padIndex, velocity = 127) => {
    const { isPlaying, isRecording, currentStep, patterns, stepCount, lastStepSettings, activePatternId, patternLibrary } = get();
    if (!isPlaying || !isRecording || currentStep < 0) return;

    const key = `${channel}-${padIndex}`;
    let track = patterns[key] ? [...patterns[key]] : [];

    // Ensure track length
    if (track.length < stepCount) {
      const missing = stepCount - track.length;
      track = [...track, ...Array.from({ length: missing }, createDefaultStep)];
    }

    // Record the Hit at currentStep
    track[currentStep] = {
      ...track[currentStep],
      active: true,
      velocity: velocity,
      pitch: lastStepSettings.pitch, // Use last used pitch
      length: lastStepSettings.length // Use last used length
    };

    const newPatterns = { ...patterns, [key]: track };
    const updatedPattern = { ...patternLibrary[activePatternId], tracks: newPatterns };
    const newLibrary = { ...patternLibrary, [activePatternId]: updatedPattern };

    set({ patterns: newPatterns, patternLibrary: newLibrary });
    dbService.savePattern(updatedPattern);
  },

  // --- Song Mode Actions ---

  setActivePatternId: (id) => {
    const { patternLibrary, activePatternId } = get();
    if (id === activePatternId) return;

    const targetPattern = patternLibrary[id];
    if (!targetPattern) return;

    set({
      activePatternId: id,
      patterns: targetPattern.tracks,
      stepCount: targetPattern.stepCount
    });

    // Save metadata essentially saying "this is the one we are looking at"
    // (Optional, not strictly needed)
  },

  createPattern: (id) => {
    const { patternLibrary } = get();
    if (patternLibrary[id]) return;

    const index = parseInt(id.split('-')[1]);
    const nameLetter = String.fromCharCode(65 + index); // 0 -> A, 15 -> P
    const newPattern: Pattern = {
      id,
      name: `Pattern ${nameLetter}`,
      tracks: {},
      stepCount: 16
    };

    set({ patternLibrary: { ...patternLibrary, [id]: newPattern } });
    dbService.savePattern(newPattern);
  },

  setIsSongMode: (enabled) => set({ isSongMode: enabled }),

  setSong: (song) => {
    set({ song });
    dbService.saveSong(song);
  },

  addToSong: (patternId) => {
    const { song } = get();
    const newItem: SongItem = {
      id: `song-item-${Date.now()}`,
      patternId
    };
    const newSong = [...song, newItem];
    set({ song: newSong, selectedSongIndex: newSong.length - 1 });
    dbService.saveSong(newSong);
  },

  insertIntoSong: (patternId, afterIndex) => {
    const { song, patternLibrary } = get();
    const newItem: SongItem = {
      id: `song-item-${Date.now() + Math.random()}`,
      patternId
    };

    let newSong = [...song];
    if (afterIndex === -1 && song.length === 0) {
      newSong = [newItem];
    } else {
      newSong.splice(afterIndex + 1, 0, newItem);
    }

    // Auto-select and sync playback buffer to the inserted pattern
    const nextIdx = afterIndex + 1;
    const pattern = patternLibrary[newItem.patternId];

    const updates: Partial<SequencerState> = {
      song: newSong,
      selectedSongIndex: nextIdx,
      songIndex: nextIdx
    };

    if (pattern) {
      updates.activePatternId = pattern.id;
      updates.patterns = pattern.tracks;
      updates.stepCount = pattern.stepCount;
    }

    set(updates);
    dbService.saveSong(newSong);
  },

  setSelectedSongIndex: (index) => {
    const { song, patternLibrary, isPlaying } = get();
    if (index < -1 || index >= song.length) return;

    const updates: Partial<SequencerState> = { selectedSongIndex: index };

    // Sync the playback head (songIndex) to the selection
    // This ensures that stop/restart OR transitions during playback respect the selection
    if (index >= 0) {
      updates.songIndex = index;
    }

    // Also sync the playback patterns to the selected one so user hears/sees it
    if (index >= 0 && index < song.length) {
      const item = song[index];
      const pattern = patternLibrary[item.patternId];
      if (pattern) {
        updates.activePatternId = pattern.id;
        updates.patterns = pattern.tracks;
        updates.stepCount = pattern.stepCount;
      }
    }

    set(updates);
  },

  removeFromSong: (index) => {
    const { song, selectedSongIndex } = get();
    const newSong = song.filter((_, i) => i !== index);

    // Adjust selection
    let nextSelected = selectedSongIndex;
    if (index <= selectedSongIndex) {
      nextSelected = Math.max(-1, selectedSongIndex - 1);
    }
    if (newSong.length === 0) nextSelected = -1;

    set({ song: newSong, selectedSongIndex: nextSelected });
    dbService.saveSong(newSong);
  },

  advanceSong: () => {
    const { song, songIndex, activePatternId, patternLibrary } = get();
    if (song.length === 0) return;

    // Check if current item repeats are done?
    // Actually, usually app logic handles repeats by counting loops.
    // For now, let's assume App.tsx decides WHEN to call advanceSong (e.g. after X loops).
    // But `advanceSong` implies moving to the NEXT item in song.

    const nextIndex = (songIndex + 1) % song.length;
    const nextItem = song[nextIndex];

    // Load the pattern
    if (nextItem && patternLibrary[nextItem.patternId]) {
      const pattern = patternLibrary[nextItem.patternId];
      set({
        songIndex: nextIndex,
        selectedSongIndex: nextIndex, // Keep UI selection in sync with playback
        activePatternId: pattern.id,
        patterns: pattern.tracks,
        stepCount: pattern.stepCount
      });
    }
  },

  cyclePattern: () => {
    const { activePatternId, patternLibrary, createPattern, setActivePatternId } = get();
    const currentIndex = parseInt(activePatternId.split('-')[1] || '0');
    const nextIndex = (currentIndex + 1) % 16;
    const nextId = `ptn-${nextIndex}`;

    if (!patternLibrary[nextId]) {
      createPattern(nextId);
    }
    setActivePatternId(nextId);
  }

}));
