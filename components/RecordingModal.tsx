
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, RotateCcw, Play, Check, X, Activity, Volume2 } from 'lucide-react';
import { useAudioStore } from '../stores/audioStore';

interface RecordingModalProps {
  onClose: () => void;
  onSave: (buffer: AudioBuffer, name: string) => void;
}

type RecState = 'MONITORING' | 'RECORDING' | 'PREVIEW';

const STORAGE_KEY_THRESHOLD = 'uss44_rec_threshold';

export const RecordingModal: React.FC<RecordingModalProps> = ({ onClose, onSave }) => {
  const [state, setState] = useState<RecState>('MONITORING');
  const [threshold, setThreshold] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THRESHOLD);
    return saved ? parseFloat(saved) : 0.05;
  });
  const [inputLevel, setInputLevel] = useState(0);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { audioContext, initMic, closeMic, startRecording, stopRecording, micAnalyser } = useAudioStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Refs for loop access to avoid stale closures
  const stateRef = useRef<RecState>('MONITORING');
  const thresholdRef = useRef(threshold);
  const recordedBufferRef = useRef<AudioBuffer | null>(null);
  const isPreviewingRef = useRef(false);

  // Preview Playback tracking
  const previewStartTimeRef = useRef<number>(0);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Sync state with ref
  const updateState = (s: RecState) => {
    stateRef.current = s;
    setState(s);
  };

  useEffect(() => {
    thresholdRef.current = threshold;
    localStorage.setItem(STORAGE_KEY_THRESHOLD, threshold.toString());
  }, [threshold]);

  useEffect(() => {
    // Initialize mic via store (uses AudioWorklet now)
    initMic();
    startVisualizer();
    return () => {
      cancelAnimationFrame(animationRef.current);
      closeMic();
      previewSourceRef.current?.stop();
    };
  }, []);

  const startVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We'll use a temp array for time domain data
    const timeData = new Float32Array(2048);
    // And byte array for frequency if needed, but we draw waveform here
    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }
      
      ctx.save();
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, w, h);

      if (stateRef.current === 'PREVIEW' && recordedBufferRef.current) {
        // --- PREVIEW MODE (Static Waveform) ---
        const buffer = recordedBufferRef.current;
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / w);
        const amp = h / 2.5;

        ctx.strokeStyle = '#e2e2e7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
          let min = 1.0, max = -1.0;
          for (let j = 0; j < step; j++) {
            const idx = (i * step) + j;
            if (idx >= data.length) break;
            const datum = data[idx];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
          }
          ctx.moveTo(i, (1 + min) * amp + (h/2 - amp));
          ctx.lineTo(i, (1 + max) * amp + (h/2 - amp));
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();

        // Playhead
        if (isPreviewingRef.current && audioContext) {
          const elapsed = audioContext.currentTime - previewStartTimeRef.current;
          const progress = Math.min(1, elapsed / buffer.duration);
          const x = progress * w;
          
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
          
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'white';
          ctx.stroke();
          ctx.shadowBlur = 0;

          if (progress >= 1) {
             setIsPreviewing(false);
             isPreviewingRef.current = false;
          }
        }
      } else {
        // --- LIVE MONITORING / RECORDING MODE ---
        // Use the AnalyserNode from the store
        const analyser = useAudioStore.getState().micAnalyser;
        
        if (analyser) {
          analyser.getFloatTimeDomainData(timeData);
          
          // 1. Calculate Level for Meter & Threshold
          let max = 0;
          let rms = 0;
          for (let i = 0; i < timeData.length; i++) {
             const val = timeData[i];
             if (Math.abs(val) > max) max = Math.abs(val);
             rms += val * val;
          }
          rms = Math.sqrt(rms / timeData.length);
          
          // Update React state for meter (throttled visually by React, but values are fresh)
          setInputLevel(max);

          // 2. Threshold Logic
          if (stateRef.current === 'MONITORING') {
             if (max > thresholdRef.current) {
                startRecording(); // Trigger store recording
                updateState('RECORDING');
             }
          }

          // 3. Draw Real-time Waveform
          ctx.lineWidth = 2;
          ctx.strokeStyle = stateRef.current === 'RECORDING' ? '#ff1e56' : '#a0a0ab';
          ctx.beginPath();
          const sliceWidth = w / timeData.length;
          let x = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i]; // -1 to 1
            const y = (v + 1) / 2 * h; // map -1..1 to 0..h? No, TimeDomain is centered at 0.
            // Map 0 to h/2. -1 to h. 1 to 0.
            // Correct: y = (1 - v) * (h/2) ?? No.
            // Center is h/2.
            const drawY = (h / 2) + (v * (h / 2));

            if (i === 0) ctx.moveTo(x, drawY);
            else ctx.lineTo(x, drawY);
            x += sliceWidth;
          }
          ctx.stroke();
        }

        // Draw Threshold Line
        if (stateRef.current === 'MONITORING') {
          const tVal = thresholdRef.current;
          // Threshold is amplitude 0..1. 
          // Center is h/2. Max is 0 or h.
          // We draw lines at +threshold and -threshold
          const topY = (h / 2) - (tVal * (h / 2));
          const botY = (h / 2) + (tVal * (h / 2));
          
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(255, 30, 86, 0.45)';
          ctx.beginPath();
          ctx.moveTo(0, topY); ctx.lineTo(w, topY);
          ctx.moveTo(0, botY); ctx.lineTo(w, botY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    };
    render();
  };

  const handleStopRecording = async () => {
    const buffer = await stopRecording();
    if (buffer) {
       setRecordedBuffer(buffer);
       recordedBufferRef.current = buffer;
       updateState('PREVIEW');
    } else {
       // Failed or empty
       retry();
    }
  };

  const previewRecording = () => {
    if (!recordedBuffer || !audioContext) return;
    if (previewSourceRef.current) {
        previewSourceRef.current.stop();
    }
    const source = audioContext.createBufferSource();
    source.buffer = recordedBuffer;
    source.connect(audioContext.destination);
    
    previewStartTimeRef.current = audioContext.currentTime;
    setIsPreviewing(true);
    isPreviewingRef.current = true;

    source.onended = () => {
        setIsPreviewing(false);
        isPreviewingRef.current = false;
    };
    source.start();
    previewSourceRef.current = source;
  };

  const handleSave = () => {
    if (recordedBuffer) {
      onSave(recordedBuffer, `REC_${Date.now() % 10000}`);
    }
  };

  const retry = () => {
    setRecordedBuffer(null);
    recordedBufferRef.current = null;
    updateState('MONITORING');
    setIsPreviewing(false);
    isPreviewingRef.current = false;
    if (previewSourceRef.current) previewSourceRef.current.stop();
  };

  return (
    <div id="recording-modal-overlay" className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-2 sm:p-8 animate-in fade-in duration-300 overflow-hidden">
      <div id="recording-modal" className="w-full max-w-lg bg-[#1e1e22] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[98dvh]">
        
        {/* Header */}
        <div id="recording-header" className="px-6 py-4 sm:px-8 sm:py-6 flex items-center justify-between border-b border-white/5 flex-none">
          <div className="flex items-center gap-3 sm:gap-5">
            <div id="rec-icon" className={`p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-zinc-800/80 ${state === 'RECORDING' ? 'text-retro-accent animate-pulse' : 'text-zinc-300'}`}>
              <Mic size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div className="flex flex-col">
              <h2 id="rec-title" className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-white leading-none">Mic Intake</h2>
              <span id="rec-status-text" className="text-[8px] sm:text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest mt-1 sm:mt-2">
                {state === 'MONITORING' && 'Waiting for input'}
                {state === 'RECORDING' && 'Capturing audio...'}
                {state === 'PREVIEW' && 'Captured Waveform'}
              </span>
            </div>
          </div>
          <button id="rec-close-btn" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
            <X size={24} className="sm:w-7 sm:h-7" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div id="rec-modal-content" className="p-3 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-y-auto no-scrollbar min-h-0">
          
          {/* Waveform Window */}
          <div id="rec-canvas-container" className={`relative aspect-[5/3] sm:aspect-video bg-black rounded-2xl sm:rounded-3xl overflow-hidden shadow-inner transition-all duration-300 border-2 flex-none ${state === 'PREVIEW' ? 'border-[#e2e2e7]/40 ring-1 ring-[#e2e2e7]/10' : 'border-zinc-800'}`}>
            <canvas id="rec-canvas" ref={canvasRef} className="w-full h-full block" />
            
            {state === 'MONITORING' && (
              <div id="rec-monitoring-overlay" className="absolute inset-0 flex items-center justify-center bg-retro-accent/5 pointer-events-none">
                <div className="text-center p-2">
                  <Activity size={24} className="text-retro-accent/30 animate-pulse mx-auto mb-2 sm:mb-4" />
                  <p className="text-retro-accent/30 font-extrabold uppercase tracking-[0.2em] text-[8px] sm:text-[10px]">Auto-Trigger Active</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div id="rec-controls" className="flex flex-col gap-3 sm:gap-4 flex-none">
            
            {state === 'MONITORING' && (
              <div id="rec-sensitivity-control" className="bg-black/20 p-3 sm:p-5 rounded-xl sm:rounded-[1.5rem] border border-white/5">
                <div className="flex justify-between items-center mb-2 sm:mb-3">
                  <label className="text-[8px] sm:text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Input Sensitivity</label>
                  <span id="sensitivity-value" className="text-[9px] sm:text-[11px] font-extrabold text-retro-accent">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <input 
                  id="sensitivity-slider"
                  type="range" min="0.01" max="0.5" step="0.01" 
                  value={threshold} 
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-retro-accent h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {state === 'RECORDING' ? (
              <button 
                id="btn-stop-rec"
                onClick={handleStopRecording}
                className="w-full bg-retro-accent text-white py-3 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-extrabold uppercase text-[10px] sm:text-xs tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 animate-pulse"
              >
                <Square size={16} className="sm:w-5 sm:h-5" fill="currentColor" /> Stop
              </button>
            ) : state === 'PREVIEW' ? (
              <div id="preview-actions" className="flex flex-col gap-2 sm:gap-4">
                <div className="flex gap-2 sm:gap-4">
                  <button 
                    id="btn-rec-retry"
                    onClick={retry}
                    className="flex-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-extrabold uppercase text-[9px] sm:text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
                  >
                    <RotateCcw size={14} className="sm:w-[18px] sm:h-[18px]" /> Retry
                  </button>
                  <button 
                    id="btn-rec-preview"
                    onClick={previewRecording}
                    className={`flex-1 py-3 sm:py-5 rounded-xl sm:rounded-2xl font-extrabold uppercase text-[9px] sm:text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5 ${isPreviewing ? 'bg-zinc-600 text-white animate-pulse' : 'bg-zinc-700/80 text-white hover:bg-zinc-600'}`}
                  >
                    <Play size={14} className="sm:w-[18px] sm:h-[18px]" fill="currentColor" /> Preview
                  </button>
                </div>
                <button 
                  id="btn-rec-save"
                  onClick={handleSave}
                  className="w-full bg-retro-accent text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-extrabold uppercase text-[10px] sm:text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 sm:gap-3 glow-red active:scale-95"
                >
                  <Check size={16} className="sm:w-5 sm:h-5" /> Load to Pad
                </button>
              </div>
            ) : (
              <div id="rec-input-meter" className="text-center w-full py-3 sm:py-5 bg-black/20 rounded-xl sm:rounded-[1.5rem] border border-white/5 px-4 sm:px-8">
                <div className="flex items-center justify-center gap-3 mb-1 sm:mb-2">
                   <Volume2 size={12} className="text-zinc-500 sm:w-[14px] sm:h-[14px]" />
                   <div className="w-20 sm:w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div id="input-meter-bar" className="h-full bg-retro-accent transition-all duration-75" style={{ width: `${Math.min(100, inputLevel * 100)}%` }} />
                   </div>
                </div>
                <p className="text-[8px] sm:text-[10px] font-extrabold text-zinc-600 uppercase tracking-widest leading-relaxed">
                  Recording triggers automatically <br/> on input threshold.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
