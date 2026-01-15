
// --- Playback Engine ---
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.sampleBuffers = new Map(); // id -> Float32Array[] (channels)
    this.nextVoiceId = 0;

    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      switch (type) {
        case 'ADD_SAMPLE':
          this.sampleBuffers.set(data.id, data.channels);
          break;
        case 'REMOVE_SAMPLE':
          this.sampleBuffers.delete(data.id);
          this.voices = this.voices.filter(v => v.sampleId !== data.id);
          break;
        case 'TRIGGER_PAD':
          this.triggerVoice(data);
          break;
        case 'RELEASE_PAD':
          this.releaseVoice(data.padId, data.startTime);
          break;
        case 'UPDATE_PAD_START_END':
          this.updateVoiceBoundaries(data);
          break;
        case 'UPDATE_PAD_PARAMS':
          this.updateVoiceParams(data);
          break;
        case 'STOP_ALL':
          this.stopAllVoices();
          break;
      }
    };
  }

  stopAllVoices() {
    const sr = sampleRate || 44100;
    for (const voice of this.voices) {
      if (!voice.finished) {
        // To avoid digital clicks, we don't just cut to zero.
        // We put the voice in a very fast release phase (10ms).

        // Calculate current envelope level to use as the starting point for fast release
        let currentEnv = 0;
        const { attack, decay, sustain, release, phase, t, releaseT, levelAtRelease } = voice.envelope;

        if (phase === 'attack') {
          currentEnv = t / Math.max(0.001, attack);
        } else if (phase === 'decay') {
          currentEnv = 1 - ((t / Math.max(0.001, decay)) * (1 - sustain));
        } else if (phase === 'sustain') {
          currentEnv = sustain;
        } else if (phase === 'release') {
          const progress = releaseT / Math.max(0.005, release);
          currentEnv = levelAtRelease * (1 - progress);
        }

        voice.envelope.phase = 'release';
        voice.envelope.levelAtRelease = Math.max(0, currentEnv);
        voice.envelope.releaseT = 0;
        voice.envelope.release = 0.01; // 10ms is long enough to avoid clicks but fast enough to feel instant
      }
    }
  }

  updateVoiceBoundaries(data) {
    const { padId, start, end } = data;
    for (const voice of this.voices) {
      if (voice.padId === padId && !voice.finished) {
        const len = voice.buffer[0].length;
        voice.startFrame = Math.floor(start * len);
        voice.endFrame = Math.floor(end * len);

        if (voice.position < voice.startFrame) {
          voice.position = voice.startFrame;
        }
        if (voice.position > voice.endFrame) {
          voice.position = voice.startFrame;
        }
      }
    }
  }

  updateVoiceParams(data) {
    const { padId, cutoff, resonance, pitch, volume, pan } = data;
    for (const voice of this.voices) {
      if (voice.padId === padId && !voice.finished) {
        if (cutoff !== undefined) voice.cutoff = cutoff;
        if (resonance !== undefined) voice.resonance = resonance;
        if (pitch !== undefined) voice.speed = pitch;
        if (volume !== undefined) voice.volume = volume;
        if (pan !== undefined) voice.pan = pan;
      }
    }
  }

  triggerVoice(data) {
    const { padId, sampleId, volume, pitch, pan, start, end, envelope, triggerMode, cutoff, resonance, startTime } = data;
    const buffer = this.sampleBuffers.get(sampleId);

    if (!buffer) return;

    this.releaseVoice(padId);

    if (this.voices.length >= 32) {
      const oldestVoice = this.voices[0];
      if (oldestVoice && !oldestVoice.finished) {
        oldestVoice.envelope.phase = 'release';
        oldestVoice.envelope.levelAtRelease = oldestVoice.envelope.levelAtRelease || 0.5;
        oldestVoice.envelope.releaseT = 0;
        oldestVoice.envelope.release = 0.005;
      }
      this.voices.shift();
    }

    const startFrame = Math.floor(start * buffer[0].length);
    const endFrame = Math.floor(end * buffer[0].length);

    const sr = sampleRate || 44100;
    const startAtFrame = startTime !== undefined ? Math.floor(startTime * sr) : currentFrame;

    this.voices.push({
      id: this.nextVoiceId++,
      padId,
      sampleId,
      buffer,
      position: startFrame,
      startFrame,
      endFrame,
      speed: pitch,
      volume,
      pan,
      triggerMode: triggerMode || 'ONE_SHOT',
      envelope: {
        ...envelope,
        phase: 'attack',
        t: 0,
        releaseT: 0,
        levelAtRelease: 0
      },
      cutoff: cutoff || 20000,
      resonance: resonance || 1.0,
      // Filter state for TPT SVF: s1 is integral of v1, s2 is integral of v2
      filterState: [
        { s1: 0, s2: 0 }, // Left
        { s1: 0, s2: 0 }  // Right
      ],
      startAtFrame,
      started: false,
      finished: false
    });
  }

  releaseVoice(padId, startTime) {
    const sr = sampleRate || 44100;
    const releaseAtFrame = startTime !== undefined ? Math.floor(startTime * sr) : currentFrame;

    for (const voice of this.voices) {
      if (voice.padId === padId && !voice.finished && voice.envelope.phase !== 'release') {
        if (voice.triggerMode === 'GATE' || voice.triggerMode === 'LOOP') {
          voice.releaseAtFrame = releaseAtFrame;
        }
      }
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channelL = output[0];
    const channelR = output[1];

    channelL.fill(0);
    if (channelR) channelR.fill(0);

    const activeVoices = [];
    const sr = sampleRate || 44100;

    for (const voice of this.voices) {
      if (voice.finished) continue;

      // Check for scheduled release
      if (voice.releaseAtFrame !== undefined && currentFrame >= voice.releaseAtFrame && voice.envelope.phase !== 'release') {
        voice.envelope.phase = 'release';
        voice.envelope.releaseT = 0;
      }

      // Filter coefficient calculation (TPT SVF)
      // Cutoff frequency mapping
      const cutoffFreq = Math.max(20, Math.min(voice.cutoff, sr * 0.49));
      const g = Math.tan(Math.PI * cutoffFreq / sr);
      // Resonance mapping: Q = resonance (roughly)
      // Standard neutral Q is 0.707 (Butterworth)
      const Q = Math.max(0.1, voice.resonance);
      const k = 1.0 / Q;

      // Precompute TPT solver coefficients
      const a1 = 1.0 / (1.0 + g * (g + k));
      const a2 = g * a1;
      const a3 = g * a2;

      for (let i = 0; i < channelL.length; i++) {
        const absoluteFrame = currentFrame + i;

        if (absoluteFrame < voice.startAtFrame) {
          continue;
        }

        voice.started = true;

        let envLevel = 0;
        const { attack, decay, sustain, release } = voice.envelope;

        if (voice.envelope.phase === 'attack') {
          voice.envelope.t += 1 / sr;
          envLevel = voice.envelope.t / Math.max(0.001, attack);
          voice.envelope.levelAtRelease = envLevel;
          if (voice.envelope.t >= attack) {
            voice.envelope.phase = 'decay';
            voice.envelope.t = 0;
            envLevel = 1;
          }
        } else if (voice.envelope.phase === 'decay') {
          voice.envelope.t += 1 / sr;
          const progress = voice.envelope.t / Math.max(0.001, decay);
          envLevel = 1 - (progress * (1 - sustain));
          voice.envelope.levelAtRelease = envLevel;
          if (voice.envelope.t >= decay) {
            voice.envelope.phase = 'sustain';
            envLevel = sustain;
          }
        } else if (voice.envelope.phase === 'sustain') {
          envLevel = sustain;
          voice.envelope.levelAtRelease = envLevel;
        } else if (voice.envelope.phase === 'release') {
          voice.envelope.releaseT += 1 / sr;
          const releaseProgress = voice.envelope.releaseT / Math.max(0.005, release);
          envLevel = voice.envelope.levelAtRelease * (1 - releaseProgress);
          if (voice.envelope.releaseT >= release) {
            voice.finished = true;
            envLevel = 0;
          }
        }

        let idx = Math.floor(voice.position);

        // Anti-NaN / Out of bounds safety
        const bufferLen = voice.buffer[0].length;
        if (idx >= voice.endFrame || idx >= bufferLen - 1) {
          if (voice.triggerMode === 'LOOP' && voice.envelope.phase !== 'release') {
            voice.position = voice.startFrame + (voice.position % (voice.endFrame - voice.startFrame || 1));
            idx = Math.floor(voice.position);
          } else {
            voice.finished = true;
            break;
          }
        }

        // Final safety clamp for idx
        idx = Math.max(0, Math.min(idx, bufferLen - 2));

        const frac = voice.position - idx;
        const bufferL = voice.buffer[0];
        const bufferR = voice.buffer[1] || bufferL;

        let sL = bufferL[idx] * (1 - frac) + bufferL[idx + 1] * frac;
        let sR = bufferR[idx] * (1 - frac) + bufferR[idx + 1] * frac;

        // Apply TPT SVF Low Pass Filter
        // Only skip if cutoff is effectively wide open and no resonance boost
        if (cutoffFreq < sr * 0.45 || Q > 1.0) {
          const inputSignals = [sL, sR];
          for (let c = 0; c < 2; c++) {
            const state = voice.filterState[c];
            let v0 = inputSignals[c];

            // Safety check for NaN or Infinity in filter state
            if (!isFinite(state.s1) || !isFinite(state.s2)) {
              state.s1 = 0;
              state.s2 = 0;
            }

            // TPT SVF Solver for Low Pass (v2)
            const v3 = v0 - state.s2;
            const v1 = a1 * state.s1 + a2 * v3;
            const v2 = state.s2 + g * v1;

            // Update state (integrators)
            state.s1 = 2 * v1 - state.s1;
            state.s2 = 2 * v2 - state.s2;

            // Safety clamp output
            inputSignals[c] = isFinite(v2) ? v2 : v0;
          }
          sL = inputSignals[0];
          sR = inputSignals[1];
        }

        const panRad = (voice.pan + 1) * (Math.PI / 4);
        const gainL = Math.cos(panRad) * voice.volume * envLevel;
        const gainR = Math.sin(panRad) * voice.volume * envLevel;

        const outL = sL * gainL;
        const outR = sR * gainR;

        // Final output safety clamp to avoid digital clipping/NaN
        channelL[i] += isFinite(outL) ? Math.max(-2, Math.min(2, outL)) : 0;
        if (channelR) channelR[i] += isFinite(outR) ? Math.max(-2, Math.min(2, outR)) : 0;

        voice.position += voice.speed;
        if (isNaN(voice.position)) {
          voice.finished = true;
          break;
        }
      }

      if (!voice.finished) {
        activeVoices.push(voice);
      }
    }

    this.voices = activeVoices;
    return true;
  }
}

// --- Recording Engine ---
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    // Pre-allocate 60 seconds of buffer at 48kHz (max safe)
    // 60 * 48000 = 2,880,000 samples
    this.maxSamples = 60 * 48000;
    this.buffer = new Float32Array(this.maxSamples);
    this.writeIndex = 0;

    this.port.onmessage = (e) => {
      const { type } = e.data;
      if (type === 'START') {
        this.writeIndex = 0;
        this.isRecording = true;
      } else if (type === 'STOP') {
        this.isRecording = false;
        // Send the relevant portion of the buffer back
        const result = this.buffer.slice(0, this.writeIndex);
        this.port.postMessage(result);
        this.writeIndex = 0;
      }
    };
  }

  process(inputs) {
    if (!this.isRecording) return true;

    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      if (inputChannel) {
        // Direct copy to pre-allocated buffer is extremely fast and Jitter-free
        const samplesToCopy = Math.min(inputChannel.length, this.maxSamples - this.writeIndex);
        if (samplesToCopy > 0) {
          this.buffer.set(inputChannel.subarray(0, samplesToCopy), this.writeIndex);
          this.writeIndex += samplesToCopy;
        } else {
          // Buffer full, stop automatically to prevent overflow
          this.isRecording = false;
        }
      }
    }
    return true;
  }
}

registerProcessor('voice-processor', VoiceProcessor);
registerProcessor('recorder-processor', RecorderProcessor);
