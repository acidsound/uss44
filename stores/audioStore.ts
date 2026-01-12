
import { create } from 'zustand';

interface AudioState {
  audioContext: AudioContext | null;
  workletNode: AudioWorkletNode | null;
  initialized: boolean;

  // Microphone / Recording State
  micStream: MediaStream | null;
  micSource: MediaStreamAudioSourceNode | null;
  micAnalyser: AnalyserNode | null;
  recorderNode: AudioWorkletNode | null;
  isRecording: boolean;
  recordedChunks: Float32Array[];
  preRollChunks: Float32Array[];

  initialize: (ctx?: AudioContext) => Promise<void>;
  resume: () => Promise<void>;
  loadSampleToWorklet: (id: string, buffer: AudioBuffer) => void;
  triggerPad: (data: any) => void;
  stopPad: (padId: string) => void;
  updatePadStartEnd: (padId: string, start: number, end: number) => void;
  updatePadParams: (padId: string, cutoff?: number, resonance?: number) => void;

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

  micStream: null,
  micSource: null,
  micAnalyser: null,
  recorderNode: null,
  isRecording: false,
  recordedChunks: [],
  preRollChunks: [],

  initialize: async (externalCtx?: AudioContext) => {
    if (get().initialized) return;

    // Use external context if provided, otherwise create new one
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = externalCtx || new AudioContextClass({ latencyHint: 'interactive' });

    try {
      // Fetch the worklet processor code with cache busting
      // Files in public/worklets/ are served at /worklets/
      const response = await fetch(`assets/worklets/VoiceProcessor.js?v=${Date.now()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch worklet: ${response.status} ${response.statusText}`);
      }

      const workletCode = await response.text();
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      try {
        await ctx.audioWorklet.addModule(workletUrl);
        console.log("AudioWorklet module loaded successfully");
      } catch (err) {
        console.error("Error adding AudioWorklet module", err);
        throw err;
      } finally {
        URL.revokeObjectURL(workletUrl);
      }

      const node = new AudioWorkletNode(ctx, 'voice-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // Master Compressor to prevent clipping
      const compressor = ctx.createDynamicsCompressor();
      node.connect(compressor);
      compressor.connect(ctx.destination);

      set({ audioContext: ctx, workletNode: node, initialized: true });

    } catch (e) {
      console.error('Failed to initialize Audio Engine:', e);
    }
  },

  resume: async () => {
    const { audioContext } = get();
    if (audioContext && audioContext.state === 'suspended') {
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

  triggerPad: (data: any) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'TRIGGER_PAD',
        data
      });
    }
  },

  stopPad: (padId: string) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'RELEASE_PAD',
        data: { padId }
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

  updatePadParams: (padId: string, cutoff?: number, resonance?: number) => {
    const { workletNode } = get();
    if (workletNode) {
      workletNode.port.postMessage({
        type: 'UPDATE_PAD_PARAMS',
        data: { padId, cutoff, resonance }
      });
    }
  },

  // --- Recording Implementation ---

  initMic: async () => {
    const { audioContext, micStream, initialized } = get();

    // Ensure we have initialized the main engine first (for AudioContext and Worklet registration)
    if (!initialized || !audioContext) {
      console.log("Audio not initialized yet, waiting...");
      await get().initialize();
    }

    if (micStream) {
      console.log("Mic already active");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      alert("Microphone recording requires a secure context (HTTPS). On some browsers, it won't work over insecure Network IP connections.");
      return;
    }

    try {
      const activeCtx = get().audioContext!;
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      console.log("Microphone access granted");

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Higher resolution for visualizer
      analyser.smoothingTimeConstant = 0.5;

      // Use the recorder-processor with 1 output to ensure it stays active in some browsers
      const recorderNode = new AudioWorkletNode(audioContext, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          bufferSize: 1024
        }
      });

      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      source.connect(analyser);
      source.connect(recorderNode);
      recorderNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      recorderNode.port.onmessage = (e) => {
        const chunk = e.data;
        if (!chunk || chunk.length === 0) return;

        set((state) => {
          // Maintain pre-roll buffer
          const updatedPreRoll = [...state.preRollChunks, chunk];
          if (updatedPreRoll.length > 25) {
            updatedPreRoll.shift();
          }

          if (state.isRecording) {
            return {
              recordedChunks: [...state.recordedChunks, chunk],
              preRollChunks: updatedPreRoll
            };
          }
          return { preRollChunks: updatedPreRoll };
        });
      };

      // Keep node alive by referencing it in store
      set({
        micStream: stream,
        micSource: source,
        micAnalyser: analyser,
        recorderNode: recorderNode
      });

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

    } catch (e) {
      console.error("Mic Initialization Failed:", e);
      alert("Microphone access failed. Please ensure permissions are granted.");
    }
  },

  closeMic: () => {
    const { micStream, micSource, recorderNode } = get();
    console.log("Closing mic...");
    micStream?.getTracks().forEach(t => t.stop());
    micSource?.disconnect();
    recorderNode?.disconnect();
    set({
      micStream: null,
      micSource: null,
      micAnalyser: null,
      recorderNode: null,
      isRecording: false,
      preRollChunks: [],
      recordedChunks: []
    });
  },

  startRecording: () => {
    console.log("Recording session starting...");
    set({ isRecording: true, recordedChunks: [] });
  },

  stopRecording: async () => {
    const { audioContext, recordedChunks, preRollChunks, isRecording } = get();
    console.log(`Stop recording called. Status: ${isRecording}, Chunks: ${recordedChunks.length}, PreRoll: ${preRollChunks.length}`);
    set({ isRecording: false });

    // Combine pre-roll and recorded chunks
    const allChunks = [...preRollChunks, ...recordedChunks];

    if (!audioContext || allChunks.length === 0) {
      console.error("No audio data captured! (onmessage might not be firing)");
      return null;
    }

    const length = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);

    let offset = 0;
    for (const chunk of allChunks) {
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    set({ recordedChunks: [] });

    return buffer;
  }
}));
