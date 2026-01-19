
import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Save, Play, Square, Loader2, Music, Check, Share2 } from 'lucide-react';
import { useSequencerStore } from '../stores/sequencerStore';
import { usePadStore } from '../stores/padStore';
import { useAudioStore } from '../stores/audioStore';
import { generateWaveform } from '../utils/audioUtils';
import { audioBufferToWav } from '../utils/wavExporter';
import { extractAndFilterSegment } from '../utils/tptFilter';
import { WaveformCanvas } from './WaveformCanvas';

interface RenderModalProps {
    onClose: () => void;
}

export const RenderModal: React.FC<RenderModalProps> = ({ onClose }) => {
    const [rendering, setRendering] = useState(false);
    const [renderedBuffer, setRenderedBuffer] = useState<AudioBuffer | null>(null);
    const [waveform, setWaveform] = useState<number[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState<number | null>(null);
    const playbackRef = useRef<AudioBufferSourceNode | null>(null);
    const playbackStartTimeRef = useRef<number>(0);

    const { patterns, bpm, stepCount } = useSequencerStore();
    const { pads, loadSample, selectedPadId } = usePadStore();
    const { audioContext } = useAudioStore();

    const handleRender = async () => {
        if (!audioContext) return;
        setRendering(true);

        try {
            const sampleRate = 44100;
            const stepDuration = (60 / bpm) / 4;
            const totalDuration = stepCount * stepDuration + 2.0; // 2s tail for release

            const offlineCtx = new OfflineAudioContext(2, Math.floor(totalDuration * sampleRate), sampleRate);

            // Compressor for preventing clipping in mixdown
            const compressor = offlineCtx.createDynamicsCompressor();
            compressor.connect(offlineCtx.destination);

            // Schedule all active steps with Choke Group support
            // Track active voices per pad for monophonic behavior
            const padVoices: Map<string, { gainNode: GainNode, endTime: number }[]> = new Map();

            for (const patternKey in patterns) {
                // patternKey format: "Channel-PadIndex" (e.g. "A-0")
                // pads are also keyed by "Channel-PadIndex"
                const steps = patterns[patternKey];
                const pad = pads[patternKey];

                if (!pad || !pad.buffer || !pad.sampleId) continue;

                const padBuffer = pad.buffer;
                const bufferDuration = padBuffer.duration;

                // Initialize voice tracking for this pad
                if (!padVoices.has(patternKey)) {
                    padVoices.set(patternKey, []);
                }

                steps.forEach((step, stepIdx) => {
                    if (!step.active || stepIdx >= stepCount) return;

                    const startTime = stepIdx * stepDuration;
                    const velocity = step.velocity / 127;
                    const pitchMultiplier = Math.pow(2, step.pitch / 12);
                    const playbackRate = (pad.pitch || 1) * pitchMultiplier;

                    // Determine playback duration based on trigger mode
                    const sampleStart = pad.start || 0;
                    const sampleEnd = pad.end || 1;
                    const segmentDuration = (sampleEnd - sampleStart) * bufferDuration;

                    let playDuration: number;
                    if (pad.triggerMode === 'ONE_SHOT') {
                        playDuration = segmentDuration / playbackRate;
                    } else if (pad.triggerMode === 'GATE' || pad.triggerMode === 'LOOP') {
                        playDuration = step.length * stepDuration;
                    } else {
                        playDuration = segmentDuration / playbackRate;
                    }

                    // Choke Group: For GATE/LOOP modes, cut off previous voices on this pad
                    if (pad.triggerMode === 'GATE' || pad.triggerMode === 'LOOP') {
                        const voices = padVoices.get(patternKey)!;
                        for (const voice of voices) {
                            // If previous voice is still playing at this startTime, fade it out quickly
                            if (voice.endTime > startTime) {
                                const chokeTime = startTime;
                                const fadeOutDuration = 0.005; // 5ms fade to avoid clicks
                                voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, chokeTime);
                                voice.gainNode.gain.linearRampToValueAtTime(0, chokeTime + fadeOutDuration);
                            }
                        }
                    }

                    // Apply TPT SVF filter (identical to VoiceProcessor) and extract segment
                    const filteredBuffer = extractAndFilterSegment(
                        padBuffer,
                        sampleStart,
                        sampleEnd,
                        pad.cutoff || 20000,
                        pad.resonance || 1,
                        sampleRate
                    );

                    // Create source node with pre-filtered buffer
                    const source = offlineCtx.createBufferSource();
                    source.buffer = filteredBuffer;
                    source.playbackRate.value = playbackRate;
                    source.loop = pad.triggerMode === 'LOOP';
                    source.loopStart = 0;
                    source.loopEnd = filteredBuffer.duration;

                    // Envelope Gain node (for ADSR)
                    const envGain = offlineCtx.createGain();
                    const env = pad.envelope || { attack: 0.001, decay: 0.1, sustain: 1, release: 0.05 };
                    const peakLevel = (pad.volume || 1) * velocity;

                    // ADSR Envelope automation
                    const attackEnd = startTime + env.attack;
                    const decayEnd = attackEnd + env.decay;
                    const sustainLevel = peakLevel * env.sustain;

                    envGain.gain.setValueAtTime(0, startTime);
                    envGain.gain.linearRampToValueAtTime(peakLevel, attackEnd);
                    envGain.gain.linearRampToValueAtTime(sustainLevel, decayEnd);

                    // Schedule release
                    const releaseStart = startTime + playDuration - env.release;
                    const releaseEnd = startTime + playDuration;
                    envGain.gain.setValueAtTime(sustainLevel, Math.max(releaseStart, decayEnd));
                    envGain.gain.linearRampToValueAtTime(0, releaseEnd);

                    // Track this voice for choke group
                    padVoices.get(patternKey)!.push({ gainNode: envGain, endTime: releaseEnd });

                    // Panner node
                    const pannerNode = offlineCtx.createStereoPanner();
                    pannerNode.pan.value = pad.pan || 0;

                    // Connect chain: source -> envelope -> panner -> compressor
                    source.connect(envGain);
                    envGain.connect(pannerNode);
                    pannerNode.connect(compressor);

                    // Schedule playback
                    source.start(startTime, 0);
                    source.stop(releaseEnd + 0.05);
                });
            }

            const result = await offlineCtx.startRendering();
            setRenderedBuffer(result);
            setWaveform(generateWaveform(result, 300));

        } catch (e) {
            console.error("Render failed:", e);
        } finally {
            setRendering(false);
        }
    };

    const handleDownload = () => {
        if (!renderedBuffer) return;
        const blob = audioBufferToWav(renderedBuffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uss44_render_${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLoadToPad = async () => {
        if (!renderedBuffer || !audioContext) return;
        const padIndex = parseInt(selectedPadId.split('-')[1]);
        const blob = audioBufferToWav(renderedBuffer);
        const url = URL.createObjectURL(blob);
        await loadSample(padIndex, url, `Rendered ${new Date().toLocaleTimeString()}`);
        // No revokeObjectURL yet because loadSample might need it for a fetch
        onClose();
    };

    const togglePlayback = () => {
        if (isPlaying) {
            playbackRef.current?.stop();
            setIsPlaying(false);
            setPlayheadPosition(null);
        } else {
            if (!renderedBuffer || !audioContext) return;
            const source = audioContext.createBufferSource();
            source.buffer = renderedBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                setIsPlaying(false);
                setPlayheadPosition(null);
            };

            const startTime = audioContext.currentTime;
            playbackStartTimeRef.current = startTime;

            source.start();
            playbackRef.current = source;
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        let animationFrame: number;

        const updatePlayhead = () => {
            if (isPlaying && renderedBuffer && audioContext) {
                const elapsed = audioContext.currentTime - playbackStartTimeRef.current;
                const progress = elapsed / renderedBuffer.duration;

                if (progress >= 1) {
                    setPlayheadPosition(null);
                    setIsPlaying(false);
                } else {
                    setPlayheadPosition(progress);
                    animationFrame = requestAnimationFrame(updatePlayhead);
                }
            }
        };

        if (isPlaying) {
            animationFrame = requestAnimationFrame(updatePlayhead);
        } else {
            setPlayheadPosition(null);
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isPlaying, renderedBuffer, audioContext]);

    useEffect(() => {
        return () => {
            playbackRef.current?.stop();
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-retro-panel border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-retro-accent/20 rounded-lg">
                            <Share2 size={18} className="text-retro-accent shadow-glow" />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-widest text-white">Renderer</h2>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase">Mixdown project to Audio</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!renderedBuffer && !rendering && (
                        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
                            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center border border-white/5">
                                <Music size={32} className="text-zinc-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-extrabold text-white uppercase tracking-tight">Ready to Render</h3>
                                <p className="text-[11px] text-zinc-500 max-w-[280px]">
                                    All active channels and patterns will be combined into a high-quality 44.1kHz WAV file.
                                </p>
                            </div>
                            <button
                                onClick={handleRender}
                                className="group relative px-8 py-3 bg-retro-accent hover:bg-retro-highlight text-white rounded-2xl font-extrabold uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-retro-accent/20"
                            >
                                Start Mixdown
                            </button>
                        </div>
                    )}

                    {rendering && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 size={40} className="text-retro-accent animate-spin" />
                            <div className="text-center">
                                <p className="text-xs font-extrabold uppercase tracking-widest text-white animate-pulse">Rendering...</p>
                                <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Processing AudioWorklet in Offline Context</p>
                            </div>
                        </div>
                    )}

                    {renderedBuffer && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-300">
                            {/* Waveform Preview using Canvas */}
                            <div className="h-32 bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden group">
                                <WaveformCanvas
                                    waveform={waveform}
                                    buffer={renderedBuffer}
                                    color="#ff3c6a"
                                    backgroundColor="transparent"
                                    showCenterLine={true}
                                    showGrid={false}
                                    showRuler={true}
                                    duration={renderedBuffer.duration}
                                    playheadPosition={playheadPosition}
                                    className="rounded-2xl"
                                />

                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                    <button
                                        onClick={togglePlayback}
                                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                                    >
                                        {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all active:scale-95 border border-white/5"
                                >
                                    <Download size={14} />
                                    <span>Download</span>
                                </button>
                                <button
                                    onClick={handleLoadToPad}
                                    className="flex items-center justify-center gap-2 py-3 bg-retro-accent hover:bg-retro-highlight text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-retro-accent/20"
                                >
                                    <Save size={14} />
                                    <span>Load to Pad</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-center gap-2 py-2">
                                <Check size={12} className="text-emerald-500" />
                                <span className="text-[9px] font-extrabold uppercase text-zinc-500">Render Successful • {renderedBuffer.duration.toFixed(2)}s @ 44.1kHz</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
