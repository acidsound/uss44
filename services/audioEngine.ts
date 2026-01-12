import { Sample } from '../types';

interface EngineSample extends Sample {
  buffer?: AudioBuffer;
  pitch: number;
  filterCutoff: number;
  filterRes: number;
  volume: number;
  pan: number;
  start: number;
  end: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Scheduling
  private isPlaying: boolean = false;
  private current16thNote: number = 0;
  private nextNoteTime: number = 0;
  private scheduleAheadTime: number = 0.1;
  private lookahead: number = 25.0; // ms
  private timerID: number | null = null;
  private bpm: number = 90;

  // Callbacks
  private onStep: ((step: number) => void) | null = null;
  private getTrackData: (() => Record<string, boolean[]>) | null = null;
  
  // Samples
  private samples: Map<string, EngineSample> = new Map();

  constructor() {
    // Initialized on user interaction
  }

  public init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.analyser = this.ctx.createAnalyser();
    
    // Reverb (Simple Impulse)
    this.reverbNode = this.ctx.createConvolver();
    this.generateImpulse();

    // Wiring
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    // Default Reverb Dry (can implement Wet/Dry later)
    // For now, we don't connect reverb directly to master to keep it dry by default
    // We would use Send/Return architecture for proper FX
  }

  private generateImpulse() {
    if (!this.ctx || !this.reverbNode) return;
    const rate = this.ctx.sampleRate;
    const length = rate * 2.0; // 2 seconds
    const decay = 2.0;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i; // reverse index not needed for noise burst
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    this.reverbNode.buffer = impulse;
  }

  public async loadSample(id: string, url: string): Promise<AudioBuffer> {
    if (!this.ctx) this.init();
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status} fetching ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (e) {
        console.error(`Audio Engine Error: Failed to load sample ${id}`, e);
        throw e;
    }
  }

  public registerSample(sample: EngineSample) {
    this.samples.set(sample.id, sample);
  }

  public getAnalyser() {
    return this.analyser;
  }

  public playSample(sampleId: string, velocity: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    const sample = this.samples.get(sampleId);
    if (!sample || !sample.buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = sample.buffer;

    // Parameters
    source.playbackRate.value = sample.pitch;
    
    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sample.filterCutoff;
    filter.Q.value = sample.filterRes;

    // Envelope / Volume
    const gainNode = this.ctx.createGain();
    // Simple decay for now, could be ADSR
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(sample.volume * velocity, this.ctx.currentTime + 0.01);
    // gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + sample.buffer.duration / sample.pitch);

    // Stereo Panner
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = sample.pan;

    // Connect Graph
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.compressor!); 

    // Calculate start/end
    const startOffset = sample.buffer.duration * sample.start;
    const duration = (sample.buffer.duration * sample.end) - startOffset;

    source.start(this.ctx.currentTime, startOffset, duration > 0 ? duration : 0.1);
  }

  // --- Sequencer Logic ---

  public setBpm(bpm: number) {
    this.bpm = bpm;
  }

  public setCallbacks(onStep: (step: number) => void, getTrackData: () => Record<string, boolean[]>) {
    this.onStep = onStep;
    this.getTrackData = getTrackData;
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    this.current16thNote++;
    if (this.current16thNote === 16) {
      this.current16thNote = 0;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    // Notify UI
    if (this.onStep) {
        // We use requestAnimationFrame to sync UI updates slightly better than pure SetTimeout, 
        // but for simple step display, direct call is okay, usually scheduled via a draw loop or similar.
        // For this demo, we'll try to sync it.
        const drawTime = (time - this.ctx!.currentTime);
        if(drawTime > 0) {
            setTimeout(() => this.onStep!(beatNumber), drawTime * 1000);
        } else {
             this.onStep(beatNumber);
        }
    }

    if (!this.getTrackData) return;
    const tracks = this.getTrackData();

    // Iterate all tracks (samples)
    Object.keys(tracks).forEach(sampleId => {
      const trackSteps = tracks[sampleId];
      if (trackSteps && trackSteps[beatNumber]) {
        // We need to trigger the playSample function AT specific time
        this.playSampleAtTime(sampleId, time);
      }
    });
  }

  public playSampleAtTime(sampleId: string, time: number) {
    if (!this.ctx || !this.masterGain) return;
    const sample = this.samples.get(sampleId);
    if (!sample || !sample.buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.pitch;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sample.filterCutoff;
    filter.Q.value = sample.filterRes;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = sample.volume;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = sample.pan;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.compressor!);

    const startOffset = sample.buffer.duration * sample.start;
    const duration = (sample.buffer.duration * sample.end) - startOffset;

    source.start(time, startOffset, duration > 0 ? duration : 0.1);
  }

  private scheduler() {
    // While there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    while (this.nextNoteTime < this.ctx!.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextNote();
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  public startSequencer() {
    if (this.isPlaying) return;
    if (!this.ctx) this.init();
    
    // Resume context if suspended (browser policy)
    if (this.ctx!.state === 'suspended') {
      this.ctx!.resume();
    }

    this.isPlaying = true;
    this.current16thNote = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1;
    this.scheduler();
  }

  public stopSequencer() {
    this.isPlaying = false;
    if (this.timerID) {
      window.clearTimeout(this.timerID);
    }
  }
  
  public toggleSequencer() {
      if(this.isPlaying) this.stopSequencer();
      else this.startSequencer();
      return this.isPlaying;
  }
}

export const audioEngine = new AudioEngine();