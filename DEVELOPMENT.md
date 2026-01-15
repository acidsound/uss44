# Social Sampler Development Guide

This document provides a comprehensive technical overview of the Social Sampler architecture and implementation details for developers. It is designed to enable a new developer or AI session to understand, maintain, and extend the project with high fidelity.

---

## 1. Project Overview
Social Sampler is a web-based MPC-style sampler designed for real-time audio performance and creative sampling from social media sources.

- **Core Features**: 4x4 Pad Grid, Dynamic Sample Pack Loading (JSON URLs), Autocorrelation-based BPM Detection, 32-voice DSP engine, Step sequencer, Master effects, and Mobile-first touch optimization.
- **Tech Stack**: 
  - **Frontend**: Vite, React 19, TypeScript
  - **State Management**: Zustand
  - **Audio Engine**: Web Audio API (Custom AudioWorklet)
  - **Processing**: `ffmpeg.wasm` (Local video extraction)
  - **Storage**: IndexedDB (Audio data persistence, Sample pack definitions)
- **Terminology**:
  - **Channel**: A performance group of 16 pads (A, B, C, D).
  - **Bank**: A library category for grouping samples in the Dig Library.
- **Philosophy**: Low-latency real-time processing, "Social Digging" workflow, and a premium, responsive UI.

---

## 2. Architecture Overview
The codebase is structured to decouple UI from business logic and audio processing.

```
src/
├── audio/          # Audio processing utilities
│   ├── audioUtils.ts      # autoCropSample, generateSlices
│   ├── sampleCache.ts     # IndexedDB persistence (social-sampler-db)
│   ├── initSamples.ts     # Initial sample loading/restoration logic
│   ├── wavExport.ts       # WAV file encoding and export
│   ├── videoExtractor.ts  # ffmpeg.wasm logic for video to audio
│   └── youtubeExtractor.ts # YouTube URL extraction (via backend)
├── stores/         # Zustand state management
│   ├── audioStore.ts      # AudioContext lifecycle, Worklet reference
│   ├── padStore.ts        # 64 pads (4 channels × 16), configuration
│   ├── sampleStore.ts     # In-memory sample library
│   ├── patternStore.ts    # 8 patterns × 16 tracks × 16 steps
│   ├── transportStore.ts  # BPM, playback state, sequencer mode
│   └── effectsStore.ts    # Global delay/reverb parameters
├── types/          # TypeScript definitions
│   ├── audio.ts           # PadConfig, Sample, ADSREnvelope
│   ├── sequencer.ts       # Pattern, Step, TransportState
│   └── ui.ts              # ChannelId, PAD_KEYBOARD_MAP
├── ui/components/  # Modular React components
│   ├── Header.tsx         # Global LCD status, BPM, Mode
│   ├── PadGrid.tsx        # 4×4 grid with touch/drag-drop support
│   ├── Pad.tsx            # Individual pad with visual feedback
│   ├── Waveform.tsx       # Canvas-based waveform with start/end handles
│   ├── StepSequencer.tsx  # 16-step grid for pattern composition
│   ├── Knob.tsx           # Reusable rotary control for parameters
│   └── MasterEffects.tsx  # Global effect control panel
└── App.tsx         # Main entry, keyboard handling, sequencer scheduler
public/
└── worklets/
    └── VoiceProcessor.js  # High-performance AudioWorklet for playback
```

---

## 3. Audio Engine Deep Dive

### VoiceProcessor.js (The DSP Core)
The playback engine runs in a separate thread via `AudioWorklet` to ensure glitch-free audio regardless of main thread UI activity.

- **Location**: `/public/worklets/VoiceProcessor.js`
- **Voice Management**: 32-voice polyphony with oldest-voice stealing.
- **DSP Chain**:
  - **Per-voice**: Linear interpolation -> SVF Filter -> ADSR Envelope.
  - **Global FX**: Ping-Pong Delay -> Schroeder Reverb -> Soft Clipping (tanh).

**Message Protocol**:
```javascript
// ADD_SAMPLE: Load audio data into worklet memory
{ type: 'ADD_SAMPLE', data: { id: string, channels: Float32Array[] } }

// TRIGGER_PAD: Start voice playback
{ type: 'TRIGGER_PAD', data: {
  padId: string,
  sampleId: string,
  velocity: number,      // 0-1 (affects gain)
  pitch: number,         // semitones (-24 to +24)
  volume: number,        // 0-1
  startPoint: number,    // 0-1 normalized start position
  endPoint: number,      // 0-1 normalized end position
  envelope: { attack, decay, sustain, release }
}}

// RELEASE_PAD: Transition voice to release phase
{ type: 'RELEASE_PAD', data: { padId: string } }

// UPDATE_PAD_PARAMS: Real-time filter update
{ type: 'UPDATE_PAD_PARAMS', data: { padId, cutoff, resonance } }

// UPDATE_DELAY / UPDATE_REVERB: Global FX parameters
{ type: 'UPDATE_DELAY', data: { time, feedback, mix, enabled } }
{ type: 'UPDATE_REVERB', data: { mix, decay, enabled } }
```

**Key Implementation Details**:
- **Phase Tracking**: `voice.phase` tracks playback position. It is initialized to `startPoint * bufferLength` and playback stops when `phase >= endPhase`.
- **Filtering**: A simple 2-pole SVF (State Variable Filter). It is only applied if `cutoff < 19000` to save CPU.
- **Delay**: Uses cross-feedback between Left and Right buffers to achieve the ping-pong effect.
- **Reverb**: Schroeder-style with 4 parallel comb filters and 2 series allpass filters.

---

## 4. State Management (Zustand Stores)

### `audioStore.ts`
Manages the `AudioContext` and `AudioWorkletNode`.
- **Initialization**: `initialize()` must be called via user gesture (click/tap) due to browser autoplay policies.
- **Sample Transfer**: `sendSampleToWorklet` extracts `Float32Array` channels from an `AudioBuffer` and posts them to the worklet thread.

- **ID Pattern**: `${channelId}-${padIndex}` (e.g., `A-0` is Channel A, Pad 1).
- **Properties**: `sampleId`, `volume`, `pitch`, `filterCutoff`, `filterResonance`, `startPoint`, `endPoint`.
- **Immutability**: Always clone the `pads` object when performing updates to ensure React re-renders.

### `patternStore.ts`
Manages 8 patterns for the sequencer.
- Each pattern has tracks (linked to the 16 pads of the current channel).
- Steps include `active`, `velocity`, `probability`, and `noteLength`.

### `transportStore.ts`
Global synchronization state: BPM (20-300), Play/Stop state, and current sequencer step.
- `sequencerMode`: `trigger` (play pads) or `step` (edit pattern).
- `tapTempo()`: A utility to calculate BPM from consecutive clicks.

---

## 5. Key Component Implementation Details

### `SampleBrowser.tsx` & `SamplePackManager.tsx`
- **Dynamic Loading**: Users can add custom JSON URLs to fetch external library metadata.
- **BPM Detection**: Uses an autocorrelation-based periodic analysis algorithm to estimate BPM during preview.
- **Persistence**: Sample pack lists and currently active pack selection are stored in IndexedDB.

### `Waveform.tsx` / `WaveformEditor.tsx`
- **Rendering**: Canvas-based. Always scale using `window.devicePixelRatio` for sharp rendering on high-DPI screens.
- **Playhead**: Real-time playback position visualizer connected to `audioContext.currentTime`. Resets on transport stop.
- **Start/End Points**: Normalized 0-1 handles that update the selected pad's `startPoint` and `endPoint`.
- **Auto-Crop Algorithm**:
  1. Find peak amplitude, scan for silence threshold (2%).
  2. Return normalized positions with safety padding.

### `PadGrid.tsx`
- **Dual Mode**:
  - `trigger`: Click/Touch triggers `playSampleWorklet`.
  - `step`: Click toggles the step for the corresponding track/pad in the current pattern.
- **Drag-and-Drop**: Supports `.wav`, `.mp3`, `.mp4` file drops.

### `StepSequencer.tsx`
- Visualizes 16 steps for 8 tracks at a time.
- Uses `transportStore`'s `currentStep` to show the playhead position.

---

## 6. Sequencer Scheduler (`App.tsx`)
Precision timing is achieved using a "Look-ahead" scheduler pattern. It runs in the main thread but schedules events slightly ahead of the `AudioContext.currentTime`.

```typescript
const scheduleAheadTime = 0.1;  // How far ahead to schedule (seconds)
const lookahead = 25;           // How often to check for new notes (ms)

// Loop logic
const scheduler = () => {
  while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
    const pattern = getPattern();
    const channelIdx = getChannelIndex();
    
    pattern.tracks.forEach((track, trackIdx) => {
      const step = track.steps[currentStep];
      if (step.active && Math.random() < step.probability) {
        const padId = `${channelIdx}-${trackIdx}`;
        playSampleWorklet(padId, step.velocity);
      }
    });
    
    currentStep = (currentStep + 1) % 16;
    nextNoteTime += (60 / bpm) / 4; // 16th note duration
  }
  setTimeout(scheduler, lookahead);
};
```

---

## 7. Sample Persistence (IndexedDB)
Uses `social-sampler-db` to persist audio data between sessions.

- **Store: `samples`**: Stores metadata and raw `ArrayBuffer` data.
- **Store: `sample-packs`**: Stores user-defined library sources (JSON URLs).
- **Store: `pad-configs`**: Stores individual pad parameters including sample assignments.
- **Initialization**: On app load, `restoreSamplesFromCache()` retrieves all saved buffers and sends them to the `VoiceWorklet` immediately. `loadSamplePack` fetches remote metadata for the library.

---

## 8. Feature Implementation Guide

### Adding a New Effect
1. **State**: Add params to `effectsStore.ts`.
2. **Worklet Setup**: Add variables and buffers to `VoiceProcessor.js` constructor.
3. **Communication**: Add a message type (e.g., `UPDATE_PHASER`) in `onmessage`.
4. **DSP**: Implement the processing logic inside the `process()` loop.
5. **UI**: Add controls to `MasterEffects.tsx`.

### Adding a New Pad Parameter (e.g., Pan)
1. **Types**: Add to `PadConfig` in `types/audio.ts`.
2. **Store**: Set a default in `padStore.ts`'s `createDefaultPad()`.
3. **App Logic**: Update `playSampleWorklet()` in `App.tsx` to include the new parameter in the `TRIGGER_PAD` message.
4. **DSP**: Update `triggerVoice()` and the `process()` loop in `VoiceProcessor.js` to utilize the new parameter.

---

## 9. CSS Design Tokens
Located in `src/index.css`. Follow these for consistent aesthetics.

```css
:root {
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #252525;
  --color-accent-red: #e85a5a;
  --color-accent-cyan: #00f3ff;
  
  --color-channel-a: #ff5722;
  --color-channel-b: #00d9ff;
  --color-channel-c: #a855f7;
  --color-channel-d: #00ff66;
  
  --font-primary: 'Inter', system-ui;
  --font-mono: 'JetBrains Mono', monospace;
  
  --shadow-pad: 0 4px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

---

## 10. Development Workflow

```bash
# 1. Install Dependencies
npm install

# 2. Start Frontend
npm run dev

# 3. Start Backend (Required for YouTube extraction)
cd backend && node server.js

# 4. Run Both Concurrently
npm run dev:all

# 5. Build for Production
npm run build
```

---

## 11. Known Implementation Patterns
1. **Browser Autoplay**: Always check `audioContext.state`. If 'suspended', call `audioStore.resume()` on the first user interaction.
2. **Touch Optimization**: Use `touch-action: none` on pads and knobs to prevent browser scrolling/zooming during interaction.
3. **Audio Clipping**: The `VoiceProcessor` uses `Math.tanh()` as a soft-clipper. Keep master gain around 0.8 to leave headroom for multiple voices.

---

## 12. Debugging Checklist
- [ ] **No Audio?**: Check if `AudioContext` is 'running' and `voiceWorklet` is not null.
- [ ] **Worklet Error?**: Check console for `AudioWorkletNode` load failures (usually a 404 on `VoiceProcessor.js`).
- [ ] **Sample not playing?**: Ensure the `sampleId` exists in `sampleStore` and has been sent to the worklet via `ADD_SAMPLE`.
- [ ] **Timing jitter?**: Verify the scheduler look-ahead window is sufficient (100ms is standard).
