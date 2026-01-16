import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Menu, Activity, Mic, ChevronRight, ChevronLeft } from 'lucide-react';

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
import { PadMenu } from './components/PadMenu';
import { AppMode, ChannelId } from './types';
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isUltraSampleMode, setIsUltraSampleMode] = useState(false);
  const [showBpmModal, setShowBpmModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPadMenu, setShowPadMenu] = useState(false);
  const [padMenuAnchor, setPadMenuAnchor] = useState<DOMRect | undefined>(undefined);

  const { initialize, resume, initialized, initMic, closeMic, startRecording, stopRecording, loadSampleToWorklet } = useAudioStore((state) => state);
  const { initPads, currentChannel, setChannel, selectedPadId, selectPad, triggerPad, stopPad, updatePad, isHydrating } = usePadStore((state) => state);
  const { bpm, isPlaying, currentStep, setStep, togglePlay, toggleStep, setSelectedStepIndex, initSequencer } = useSequencerStore((state) => state);

  const selectedPadIndex = parseInt(selectedPadId.split('-').pop() || '0');
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
      const sampleId = `${currentChannel}-${padIdx}-ultra-${Date.now()}`;
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

      const padding = Math.floor(buffer.sampleRate * 0.03); // Increased to 30ms for safety
      startIdx = Math.max(0, startIdx - padding);
      endIdx = Math.min(data.length - 1, endIdx + padding);

      const startNorm = startIdx / data.length;
      const endNorm = endIdx / data.length;

      const finalStart = startNorm < endNorm ? startNorm : 0;
      const finalEnd = startNorm < endNorm ? endNorm : 1;

      updatePad(padIdx, {
        sampleId,
        buffer,
        start: finalStart,
        end: finalEnd,
        viewStart: finalStart,
        viewEnd: finalEnd,
        triggerMode: 'GATE'
      });

      // Update the centralized samples lookup
      usePadStore.setState(state => ({
        samples: { ...state.samples, [sampleId]: { name: 'ULTRA_REC', waveform } }
      }));

      // Persist the recorded sample data
      await dbService.saveSample({
        id: sampleId,
        name: 'ULTRA_REC',
        data: arrayBuffer,
        waveform
      });

    }
  }, [isUltraSampleMode, currentChannel, loadSampleToWorklet, updatePad, stopRecording]);

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
          if (isEditMode) {
            setSelectedStepIndex(padIdx);
          } else {
            toggleStep(currentChannel, selectedPadIndex, padIdx);
            setSelectedStepIndex(padIdx);
          }
        } else if (isEditMode) {
          selectPad(padIdx);
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

        if (mode !== AppMode.SEQUENCE && !isEditMode) {
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
  }, [mode, currentChannel, selectedPadIndex, togglePlay, selectPad, triggerPad, stopPad, toggleStep, setSelectedStepIndex, isUltraSampleMode, isEditMode, handleUltraRecordStart, handleUltraRecordStop]);

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
  }, [initialized, initPads, initSequencer, initialize, resume]);

  // iOS Audio Context Resume - Show prompt when audio is suspended after background return
  const [showAudioResumePrompt, setShowAudioResumePrompt] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && initialized) {
        const { audioContext } = useAudioStore.getState();
        if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
          // Show prompt to user - iOS requires user gesture to resume
          setShowAudioResumePrompt(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initialized]);

  const handleAudioResume = async () => {
    await resume();
    setShowAudioResumePrompt(false);
  };

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

  const cycleChannel = () => {
    const channels: ChannelId[] = ['A', 'B', 'C', 'D'];
    const currentIndex = channels.indexOf(currentChannel);
    const nextChannel = channels[(currentIndex + 1) % 4];
    setChannel(nextChannel);
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
      setStep(-1);
      currentStepRef.current = 0;
      usePadStore.getState().resetAllPads();
      useAudioStore.getState().stopAll();
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
    const patterns = useSequencerStore.getState().patterns;
    const patternKeys = Object.keys(patterns);

    for (const trackKey of patternKeys) {
      const track = patterns[trackKey];
      if (track && track[step] && track[step].active) {
        const stepData = track[step];
        const pitchMultiplier = Math.pow(2, stepData.pitch / 12);

        // Key format is "Channel-PadIndex" (e.g. "A-0")
        const [channelId, padIndexStr] = trackKey.split('-');
        const padIndex = parseInt(padIndexStr);

        const secondsPerBeat = 60.0 / bpmRef.current;
        const stepTimeInSeconds = 0.25 * secondsPerBeat;
        const releaseTime = time + (stepData.length * stepTimeInSeconds);

        usePadStore.getState().triggerPad(
          padIndex,
          (stepData.velocity / 127),
          pitchMultiplier,
          time,
          channelId as ChannelId
        );

        // Schedule release for GATE/LOOP modes
        // If length is at max (16.0), treat as full/infinite duration
        if (stepData.length < 16.0) {
          usePadStore.getState().stopPad(padIndex, releaseTime, channelId as ChannelId);
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
      <PadMenu
        padIndex={selectedPadIndex}
        isOpen={showPadMenu}
        onClose={() => setShowPadMenu(false)}
        anchorRect={padMenuAnchor}
      />

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

      <header id="app-header" className={`${isLandscape ? 'w-12 h-full border-r' : 'h-12 border-b'} flex-none border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex ${isLandscape ? 'flex-col' : 'flex-row'} items-center justify-between z-30 px-3`}>
        <button
          id="header-logo"
          onClick={toggleUltraSampleMode}
          className={`flex flex-row items-center gap-1 cursor-pointer group active:scale-95 transition-transform ${isUltraSampleMode ? 'scale-110' : ''}`}
        >
          {isUltraSampleMode ? (
            <Mic className="w-5 h-5 text-retro-accent animate-pulse shadow-[0_0_10px_#ff1e56]" />
          ) : (
            <Activity className="w-5 h-5 text-retro-accent group-hover:text-white transition-colors" />
          )}
          {!isLandscape && <h1 className="text-base font-extrabold tracking-tighter text-white">USS<span className="text-retro-accent">44</span></h1>}
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
              id="lcd-channel"
              onClick={cycleChannel}
              className="flex flex-col items-center gap-0.5 hover:bg-white/10 p-1 rounded transition-colors active:scale-95"
            >
              <span className="text-zinc-500 text-[8px] tracking-widest">CH.</span>
              <span className="leading-none text-white">{currentChannel}</span>
            </button>

            <button
              id="lcd-pad"
              onClick={(e) => {
                setPadMenuAnchor(e.currentTarget.getBoundingClientRect());
                setShowPadMenu(true);
              }}
              className="flex flex-col items-center gap-0.5 hover:bg-white/10 p-1 rounded transition-colors active:scale-95"
            >
              <span className="text-zinc-500 text-[8px] tracking-widest">PAD</span>
              <span className="leading-none text-white">{selectedPadIndex + 1}</span>
            </button>
          </div>
          {!isLandscape && <div id="header-visualizer" className="absolute right-0 top-0 h-full w-32 opacity-50"><Visualizer /></div>}
        </div>

        <div id="header-actions" className={`flex ${isLandscape ? 'flex-col' : 'flex-row'} items-center gap-4`}>
          <button
            id="header-settings-btn"
            onClick={() => setShowSettings(true)}
            className="p-2 text-zinc-400 hover:text-white transition-all duration-300 active:scale-95"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <main id="app-main" className="flex-1 flex flex-col bg-retro-bg relative min-h-0 overflow-hidden">
        <div id="mode-selector" className="flex-none h-6 border-b border-zinc-800/50 flex items-stretch bg-zinc-900/30">
          <div className="flex-1 flex items-stretch border-r border-zinc-800/50">
            <button
              id="mode-dig-btn"
              onClick={() => setMode(AppMode.SAMPLE)}
              className={`flex-1 flex items-center justify-center text-[11px] font-extrabold uppercase transition-all tracking-wider ${mode === AppMode.SAMPLE ? 'bg-retro-accent text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
            >
              Dig Library
            </button>
            <button
              id="mode-perform-btn"
              onClick={() => {
                setIsEditMode(!isEditMode);
                if (mode === AppMode.SAMPLE) setMode(AppMode.PERFORM);
              }}
              className={`flex-1 flex items-center justify-center text-[11px] font-extrabold uppercase transition-all tracking-wider ${!isEditMode ? 'bg-zinc-800/80 text-white' : 'bg-retro-accent text-white shadow-inner'}`}
            >
              {isEditMode ? 'Edit' : 'Perform'}
            </button>
          </div>
          <div className="flex items-stretch">
            <button
              id="mode-sequence-btn"
              onClick={() => setMode(mode === AppMode.SEQUENCE ? AppMode.PERFORM : AppMode.SEQUENCE)}
              className={`w-20 border-r border-zinc-800/50 flex flex-row gap-2 items-center justify-center transition-all ${mode === AppMode.SEQUENCE ? 'bg-retro-accent text-white shadow-lg' : 'bg-black/20 text-zinc-500 hover:text-zinc-300'}`}
            >
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
            <div className={`${isLandscape ? 'w-full h-full' : 'w-full max-w-[calc(100dvh-180px)] aspect-square p-2 mx-auto'}`}>
              <PadGrid
                appMode={mode}
                isEditMode={isEditMode}
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

      {/* iOS Audio Resume Prompt - Shown when AudioContext is suspended after background return */}
      {showAudioResumePrompt && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-in fade-in duration-200"
          onClick={handleAudioResume}
        >
          <div className="w-24 h-24 rounded-full bg-retro-accent/20 flex items-center justify-center animate-pulse">
            <svg className="w-12 h-12 text-retro-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-white uppercase tracking-wider mb-2">Audio Paused</h2>
            <p className="text-zinc-400 text-sm font-bold">Tap anywhere to resume</p>
          </div>
          <div className="mt-4 px-8 py-4 bg-retro-accent rounded-full">
            <span className="text-white font-extrabold uppercase tracking-widest text-sm">TAP TO RESUME</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
