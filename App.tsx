
import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Settings, Activity, Mic } from 'lucide-react';

// Stores
import { useAudioStore } from './stores/audioStore';
import { usePadStore } from './stores/padStore';
import { useSequencerStore } from './stores/sequencerStore';
import { dbService } from './services/dbService';

// Components & Utils
import { PadGrid } from './components/PadGrid';
import { Visualizer } from './components/Visualizer';
import { SampleBrowser } from './components/SampleBrowser';
import { LoadingOverlay } from './components/LoadingOverlay';
import { InitOverlay } from './components/InitOverlay';
import { ParametersPanel } from './components/ParametersPanel';
import { SequencePanel } from './components/SequencePanel';
import { BpmModal } from './components/BpmModal';
import { SettingsMenu } from './components/SettingsMenu';
import { AppMode, BankId } from './types';
import { STEPS_PER_BAR } from './constants';

const KEY_TO_PAD: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3,
  'q': 4, 'w': 5, 'e': 6, 'r': 7,
  'a': 8, 's': 9, 'd': 10, 'f': 11,
  'z': 12, 'x': 13, 'c': 14, 'v': 15
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.PERFORM);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isUltraSampleMode, setIsUltraSampleMode] = useState(false);
  const [showBpmModal, setShowBpmModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { initialize, resume, initialized, initMic, closeMic, startRecording, stopRecording, loadSampleToWorklet } = useAudioStore((state) => state);
  const { initPads, currentBank, setBank, selectedPadId, selectPad, triggerPad, stopPad, updatePad, isHydrating } = usePadStore((state) => state);
  const { bpm, isPlaying, currentStep, setStep, togglePlay, toggleStep, setSelectedStepIndex, initSequencer } = useSequencerStore((state) => state);

  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  // UltraSample Mode Logic
  const handleUltraRecordStart = React.useCallback((padIdx: number) => {
    if (!isUltraSampleMode) return;
    selectPad(padIdx);
    startRecording();
  }, [isUltraSampleMode, selectPad, startRecording]);

  const handleUltraRecordStop = React.useCallback(async (padIdx: number) => {
    if (!isUltraSampleMode) return;

    const buffer = await stopRecording();

    if (buffer && buffer.length > 1000) {
      const sampleId = `${currentBank}-${padIdx}-ultra-${Date.now()}`;
      const data = buffer.getChannelData(0);
      const arrayBuffer = data.buffer.slice(0);

      loadSampleToWorklet(sampleId, buffer);

      const step = Math.ceil(data.length / 200);
      const waveform = [];
      for (let i = 0; i < 200; i++) {
        let max = 0;
        for (let j = 0; j < step; j++) {
          const v = Math.abs(data[i * step + j] || 0);
          if (v > max) max = v;
        }
        waveform.push(max);
      }

      // --- Auto Crop Logic ---
      const threshold = 0.02;
      let startIdx = 0;
      let endIdx = data.length - 1;

      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
          startIdx = i;
          break;
        }
      }

      for (let i = data.length - 1; i > startIdx; i--) {
        if (Math.abs(data[i]) > threshold) {
          endIdx = i;
          break;
        }
      }

      const padding = Math.floor(buffer.sampleRate * 0.01);
      startIdx = Math.max(0, startIdx - padding);
      endIdx = Math.min(data.length - 1, endIdx + padding);

      const startNorm = startIdx / data.length;
      const endNorm = endIdx / data.length;

      const finalStart = startNorm < endNorm ? startNorm : 0;
      const finalEnd = startNorm < endNorm ? endNorm : 1;

      updatePad(padIdx, {
        sampleId,
        sampleName: 'ULTRA_REC',
        buffer,
        waveform,
        start: finalStart,
        end: finalEnd,
        viewStart: finalStart,
        viewEnd: finalEnd,
        triggerMode: 'GATE'
      });

      await dbService.saveSample({
        id: sampleId,
        name: 'ULTRA_REC',
        data: arrayBuffer,
        waveform
      });
    }
  }, [isUltraSampleMode, currentBank, loadSampleToWorklet, updatePad, stopRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const padIdx = KEY_TO_PAD[e.key.toLowerCase()];
      if (padIdx !== undefined) {
        e.preventDefault();

        if (isUltraSampleMode) {
          handleUltraRecordStart(padIdx);
          return;
        }

        if (mode === AppMode.SEQUENCE) {
          toggleStep(currentBank, selectedPadIndex, padIdx);
          setSelectedStepIndex(padIdx);
        } else {
          selectPad(padIdx);
          triggerPad(padIdx);
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const padIdx = KEY_TO_PAD[e.key.toLowerCase()];
      if (padIdx !== undefined) {
        if (isUltraSampleMode) {
          handleUltraRecordStop(padIdx);
          return;
        }

        if (mode !== AppMode.SEQUENCE) {
          stopPad(padIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, currentBank, selectedPadIndex, togglePlay, selectPad, triggerPad, stopPad, toggleStep, setSelectedStepIndex, isUltraSampleMode]);

  useEffect(() => {
    const startApp = async () => {
      if (initialized) return;
      await initialize();
      await resume();
      await initPads();
      await initSequencer();
    };
    const handleUserGesture = () => { startApp(); window.removeEventListener('click', handleUserGesture); };
    window.addEventListener('click', handleUserGesture);
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('resize', handleResize);
    };
  }, [initialized]);

  // UltraSample Mode Logic - Toggle
  const toggleUltraSampleMode = async () => {
    if (isUltraSampleMode) {
      closeMic();
      setIsUltraSampleMode(false);
    } else {
      await initMic();
      setIsUltraSampleMode(true);
      setMode(AppMode.PERFORM);
    }
  };

  const cycleBank = () => {
    const banks: BankId[] = ['A', 'B', 'C', 'D'];
    const currentIndex = banks.indexOf(currentBank);
    const nextBank = banks[(currentIndex + 1) % 4];
    setBank(nextBank);
  };

  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isPlaying) {
      const ctx = useAudioStore.getState().audioContext;
      if (!ctx) return;

      // Reset scheduling if we just started
      if (!timerRef.current) {
        nextNoteTimeRef.current = ctx.currentTime + 0.1;
      }

      const scheduler = () => {
        const activeCtx = useAudioStore.getState().audioContext;
        if (!activeCtx) return;
        const scheduleAhead = 0.1;
        while (nextNoteTimeRef.current < activeCtx.currentTime + scheduleAhead) {
          scheduleNoteAtTime(currentStepRef.current, nextNoteTimeRef.current);
          advanceStep();
        }
        timerRef.current = requestAnimationFrame(scheduler);
      };
      scheduler();
    } else {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      timerRef.current = undefined;
      // We don't reset step to -1 on pause, typically, but for this style of sequencer:
      // If we want to resume from where we left off, we shouldn't reset.
      // But if we want stop behavior:
      setStep(-1);
    }
    return () => { if (timerRef.current) cancelAnimationFrame(timerRef.current); timerRef.current = undefined; }
  }, [isPlaying]);

  const advanceStep = () => {
    const secondsPerBeat = 60.0 / bpmRef.current;
    const stepTime = 0.25 * secondsPerBeat;
    nextNoteTimeRef.current += stepTime;
    currentStepRef.current = (currentStepRef.current + 1) % STEPS_PER_BAR;
    setStep(currentStepRef.current);
  };

  const scheduleNoteAtTime = (step: number, time: number) => {
    for (let bankKey of ['A', 'B', 'C', 'D']) {
      for (let i = 0; i < 16; i++) {
        const trackKey = `${bankKey}-${i}`;
        const track = useSequencerStore.getState().patterns[trackKey];
        if (track && track[step] && track[step].active) {
          const stepData = track[step];
          const pitchMultiplier = Math.pow(2, stepData.pitch / 12);
          usePadStore.getState().triggerPad(i, (stepData.velocity / 127), pitchMultiplier, time);
        }
      }
    }
  };

  return (
    <div
      id="app-root"
      className={`
        flex ${isLandscape ? 'flex-row' : 'flex-col'} w-full h-full bg-retro-bg text-retro-text font-sans select-none overflow-hidden transition-all duration-300
        ${isUltraSampleMode ? 'border-[6px] border-retro-accent shadow-[inset_0_0_50px_rgba(255,30,86,0.3)]' : ''}
      `}
    >
      {!initialized && <InitOverlay />}
      {isHydrating && <LoadingOverlay />}
      {showBpmModal && <BpmModal onClose={() => setShowBpmModal(false)} />}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}

      {isUltraSampleMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-retro-accent text-white px-4 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-[0_0_20px_#ff1e56] animate-pulse pointer-events-none">
          UltraSample Mode Active
        </div>
      )}

      {mode === AppMode.SAMPLE && (
        <SampleBrowser
          isLandscape={isLandscape}
          onClose={() => setMode(AppMode.PERFORM)}
        />
      )}

      <header id="app-header" className={`${isLandscape ? 'w-14 h-full border-r' : 'h-14 border-b'} flex-none border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex ${isLandscape ? 'flex-col' : 'flex-row'} items-center justify-between z-30 px-3`}>
        <button
          id="header-logo"
          onClick={toggleUltraSampleMode}
          className={`flex flex-col items-center gap-0 cursor-pointer group active:scale-95 transition-transform p-2 ${isUltraSampleMode ? 'scale-110' : ''}`}
        >
          {isUltraSampleMode ? (
            <Mic className="w-5 h-5 text-retro-accent animate-pulse mb-1 shadow-[0_0_10px_#ff1e56]" />
          ) : (
            <Activity className="w-5 h-5 text-retro-accent group-hover:text-white transition-colors mb-1" />
          )}
          {!isLandscape && <h1 className="text-lg font-extrabold tracking-tighter text-white">USS<span className="text-retro-accent">44</span></h1>}
        </button>

        <div id="header-lcd" className={`${isLandscape ? 'flex-col h-auto w-full gap-4' : 'flex-1 max-w-md mx-6 h-10'} bg-black/60 rounded-lg border border-white/5 flex items-center px-4 justify-between font-sans text-[11px] text-retro-accent relative overflow-hidden shadow-inner`}>
          <div className={`z-10 flex ${isLandscape ? 'flex-col' : 'flex-row'} gap-6 uppercase items-center text-center font-extrabold`}>

            <button
              id="lcd-bpm"
              onClick={() => setShowBpmModal(true)}
              className="flex flex-col items-center gap-0.5 hover:bg-white/10 p-1 rounded transition-colors active:scale-95"
            >
              <span className="text-zinc-500 text-[8px] tracking-widest">BPM</span>
              <span className="leading-none text-white">{bpm}</span>
            </button>

            <button
              id="lcd-bank"
              onClick={cycleBank}
              className="flex flex-col items-center gap-0.5 hover:bg-white/10 p-1 rounded transition-colors active:scale-95"
            >
              <span className="text-zinc-500 text-[8px] tracking-widest">BANK</span>
              <span className="leading-none text-white">{currentBank}</span>
            </button>

            <div id="lcd-pad" className="flex flex-col items-center gap-0.5"><span className="text-zinc-500 text-[8px] tracking-widest">PAD</span><span className="leading-none text-white">{selectedPadIndex + 1}</span></div>
          </div>
          {!isLandscape && <div id="header-visualizer" className="absolute right-0 top-0 h-full w-32 opacity-50"><Visualizer /></div>}
        </div>

        <div id="header-actions" className={`flex ${isLandscape ? 'flex-col' : 'flex-row'} items-center gap-4`}>
          <button
            id="header-settings-btn"
            onClick={() => setShowSettings(true)}
            className="p-2 text-zinc-400 hover:text-white transition-all hover:rotate-90 duration-300 active:scale-95"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main id="app-main" className="flex-1 flex flex-col bg-retro-bg relative min-h-0 overflow-hidden">
        <div id="mode-selector" className="flex-none h-8 border-b border-zinc-800/50 flex items-stretch bg-zinc-900/30">
          <div className="flex-1 flex items-stretch border-r border-zinc-800/50">
            <button id="mode-dig-btn" onClick={() => setMode(AppMode.SAMPLE)} className={`flex-1 flex items-center justify-center text-[11px] font-extrabold uppercase transition-all tracking-wider ${mode === AppMode.SAMPLE ? 'bg-retro-accent text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>Dig Library</button>
            <button id="mode-perform-btn" onClick={() => setMode(AppMode.PERFORM)} className={`flex-1 flex items-center justify-center text-[11px] font-extrabold uppercase transition-all tracking-wider ${mode === AppMode.PERFORM ? 'bg-zinc-800/80 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>Perform</button>
          </div>
          <div className="flex items-stretch">
            <button id="mode-sequence-btn" onClick={() => setMode(mode === AppMode.SEQUENCE ? AppMode.PERFORM : AppMode.SEQUENCE)} className={`w-20 border-r border-zinc-800/50 flex flex-col items-center justify-center transition-all ${mode === AppMode.SEQUENCE ? 'bg-retro-accent text-white shadow-lg' : 'bg-black/20 text-zinc-500 hover:text-zinc-300'}`}>
              <span className="text-[9px] uppercase font-extrabold mb-0.5 tracking-tighter">Step</span>
              <span className={`text-xs font-extrabold ${mode === AppMode.SEQUENCE ? 'text-white' : 'text-retro-accent'}`}>{currentStep > -1 ? currentStep + 1 : '--'}</span>
            </button>
            <button id="transport-play-btn" onClick={togglePlay} className={`w-16 flex items-center justify-center transition-all ${isPlaying ? 'bg-emerald-600 text-white animate-pulse' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>
        </div>

        <div id="workspace-container" className={`flex-1 flex ${isLandscape ? 'flex-row' : 'flex-col'} overflow-hidden min-h-0`}>
          <div id="pad-grid-container" className={`${isLandscape ? 'w-1/2 p-6' : 'w-full flex-none'} flex flex-col justify-center bg-retro-bg overflow-hidden relative`}>

            {/* Bank Selector Bar */}
            <div className={`${isLandscape ? 'w-full mb-4' : 'w-full max-w-[calc(100dvh-180px)] mx-auto px-4'} flex items-center justify-between`}>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                {(['A', 'B', 'C', 'D'] as BankId[]).map(bank => (
                  <button
                    key={bank}
                    onClick={() => setBank(bank)}
                    className={`w-8 h-6 flex items-center justify-center rounded text-[10px] font-extrabold transition-all ${currentBank === bank ? `bg-bank-${bank.toLowerCase()} text-white shadow-lg scale-110` : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}
                    style={currentBank === bank ? { backgroundColor: getBankColor(bank) } : {}}
                  >
                    {bank}
                  </button>
                ))}
              </div>
              <div className="text-[9px] font-extrabold uppercase text-zinc-600 tracking-widest">
                Bank Select
              </div>
            </div>

            <div className={`${isLandscape ? 'w-full h-full' : 'w-full max-w-[calc(100dvh-180px)] aspect-square p-2 mx-auto'}`}>
              <PadGrid
                appMode={mode}
                isUltraSampleMode={isUltraSampleMode}
                onUltraRecordStart={handleUltraRecordStart}
                onUltraRecordStop={handleUltraRecordStop}
              />
            </div>
          </div>

          <div id="bottom-panel" className={`${isLandscape ? 'w-1/2 border-l' : 'flex-1 border-t'} bg-retro-panel border-zinc-800/80 flex flex-col shadow-2xl z-20 overflow-hidden relative rounded-t-2xl sm:rounded-none`}>
            {mode === AppMode.SEQUENCE ? (
              <SequencePanel />
            ) : (
              <ParametersPanel isLandscape={isLandscape} isUltraSampleMode={isUltraSampleMode} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper for dynamic colors in inline styles if Tailwind classes aren't enough or need specificity
const getBankColor = (bank: string) => {
  switch (bank) {
    case 'A': return '#ff6b3d';
    case 'B': return '#33e1ff';
    case 'C': return '#bf7aff';
    case 'D': return '#33ff8a';
    default: return '#ff6b3d';
  }
}

export default App;
