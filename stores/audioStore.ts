
import { create } from 'zustand';

interface AudioState {
  audioContext: AudioContext | null;
  workletNode: AudioWorkletNode | null;
  initialized: boolean;
  isInitializing: boolean;

  // Microphone / Recording State
  micStream: MediaStream | null;
  micSource: MediaStreamAudioSourceNode | null;
  micAnalyser: AnalyserNode | null;
  masterAnalyser: AnalyserNode | null;
  recorderNode: AudioWorkletNode | null;
  isRecording: boolean;
  recordedChunks: Float32Array[];
  preRollChunks: Float32Array[];

  initialize: (ctx?: AudioContext) => Promise<void>;
  resume: () => Promise<void>;
  loadSampleToWorklet: (id: string, buffer: AudioBuffer) => void;
  removeSampleFromWorklet: (id: string) => void;
  triggerPad: (data: any) => void;
  stopPad: (padId: string, startTime?: number) => void;
  updatePadStartEnd: (padId: string, start: number, end: number) => void;
  updatePadParams: (padId: string, params: { cutoff?: number, resonance?: number, pitch?: number, volume?: number, pan?: number }) => void;
  stopAll: () => void;

  // Recording Actions
  initMic: () => Promise<void>;
  closeMic: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<AudioBuffer | null>;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioContext: null,
  workletNode: null,
  initialized: false,
  isInitializing: false,

  micStream: null,
  micSource: null,
  micAnalyser: null,
  masterAnalyser: null,
  recorderNode: null,
  isRecording: false,
  recordedChunks: [],
  preRollChunks: [],

  initialize: async (externalCtx?: AudioContext) => {
    // Mutex: prevent multiple simultaneous initializations
    if (get().initialized || get().isInitializing) return;
    set({ isInitializing: true });

    // Use external context if provided, otherwise create new one
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Forcing 44100 often solves sample rate drift/mismatch issues on many audio interfaces
    const ctx = externalCtx || new AudioContextClass({
      latencyHint: 'interactive',
      sampleRate: 44100
    });

    try {
      // Fetch the worklet processor code with cache busting
      // Files in public/worklets/ are served at /worklets/
      const response = await fetch(`assets/worklets/VoiceProcessor.js?v=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`Worklet fetch failed: ${response.status}`);
      }

      const workletCode = await response.text();
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      try {
        await ctx.audioWorklet.addModule(workletUrl);
      } catch (err) {
        throw err;
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      const node = new AudioWorkletNode(ctx, 'voice-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // Master Analyser for UI visualization
      const masterAnalyser = ctx.createAnalyser();
      masterAnalyser.fftSize = 512;
      masterAnalyser.smoothingTimeConstant = 0.8;

      // Master Compressor to prevent clipping
      const compressor = ctx.createDynamicsCompressor();
      node.connect(compressor);
      compressor.connect(masterAnalyser);
      masterAnalyser.connect(ctx.destination);

      set({ audioContext: ctx, workletNode: node, masterAnalyser, initialized: true, isInitializing: false });

    } catch (e) {
      console.error('Failed to initialize Audio Engine:', e);
      set({ isInitializing: false });
    }
  },

  resume: async () => {
    const { audioContext } = get();
    if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
      await audioContext.resume();
    }
  },

  loadSampleToWorklet: (id: string, buffer: AudioBuffer) => {
    const { workletNode } = get();
    if (!workletNode) return;

    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    workletNode.port.postMessage({
      type: 'ADD_SAMPLE',
      data: { id, channels }
    });
  },

  removeSampleFromWorklet: (id: string) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'REMOVE_SAMPLE',
        data: { id }
      });
    }
  },

  triggerPad: (data: any) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'TRIGGER_PAD',
        data
      });
    }
  },

  stopPad: (padId: string, startTime?: number) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'RELEASE_PAD',
        data: { padId, startTime }
      });
    }
  },

  updatePadStartEnd: (padId: string, start: number, end: number) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'UPDATE_PAD_START_END',
        data: { padId, start, end }
      });
    }
  },

  updatePadParams: (padId: string, params: { cutoff?: number, resonance?: number, pitch?: number, volume?: number, pan?: number }) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'UPDATE_PAD_PARAMS',
        data: { padId, ...params }
      });
    }
  },

  stopAll: () => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({ type: 'STOP_ALL' });
    }
  },

  // --- Recording Implementation ---

  initMic: async () => {
    const { audioContext, micStream, initialized } = get();

    if (!initialized || !audioContext) {
      await get().initialize();
    }

    if (micStream) {
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      alert("Microphone recording requires a secure context (HTTPS).");
      return;
    }

    try {
      const activeCtx = get().audioContext!;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      const source = activeCtx.createMediaStreamSource(stream);
      const analyser = activeCtx.createAnalyser();
      analyser.fftSize = 2048;

      const recorderNode = new AudioWorkletNode(activeCtx, 'recorder-processor');
      const silentGain = activeCtx.createGain();
      silentGain.gain.value = 0;

      source.connect(analyser);
      source.connect(recorderNode);
      recorderNode.connect(silentGain);
      silentGain.connect(activeCtx.destination);

      // Keep node alive by referencing it in store
      set({
        micStream: stream,
        micSource: source,
        micAnalyser: analyser,
        recorderNode: recorderNode
      });

      if (activeCtx.state === 'suspended') {
        await activeCtx.resume();
      }

    } catch (e) {
      console.error("Mic Initialization Failed:", e);
    }
  },

  closeMic: () => {
    const { micStream, micSource, recorderNode } = get();
    micStream?.getTracks().forEach(t => t.stop());
    micSource?.disconnect();
    recorderNode?.disconnect();
    set({
      micStream: null,
      micSource: null,
      micAnalyser: null,
      recorderNode: null,
      isRecording: false,
      recordedChunks: []
    });
  },

  startRecording: () => {
    const { recorderNode } = get();
    if (recorderNode) {
      recorderNode.port.postMessage({ type: 'START' });
      set({ isRecording: true });
    }
  },

  stopRecording: async () => {
    const { recorderNode, audioContext } = get();
    if (!recorderNode || !audioContext) return null;

    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        const data: Float32Array = e.data;
        recorderNode.port.removeEventListener('message', onMessage);

        if (!data || data.length === 0) {
          set({ isRecording: false });
          resolve(null);
          return;
        }

        const buffer = audioContext.createBuffer(1, data.length, audioContext.sampleRate);
        buffer.getChannelData(0).set(data);

        set({ isRecording: false });
        resolve(buffer);
      };

      recorderNode.port.addEventListener('message', onMessage);
      recorderNode.port.start();
      recorderNode.port.postMessage({ type: 'STOP' });
    });
  }
}));
