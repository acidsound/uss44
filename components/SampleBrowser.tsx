
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Play, Mic2, Search, X, Library, Globe, Music, Upload, Square, HardDrive, Loader2, Mic, ChevronLeft } from 'lucide-react';
import { usePadStore, generateWaveform } from '../stores/padStore';
import { useAudioStore } from '../stores/audioStore';
import { SampleMetadata } from '../types';
import { MOCK_SOCIAL_FEED } from '../constants';
import { dbService } from '../services/dbService';
import { RecordingModal } from './RecordingModal';
import { SamplePackManager } from './SamplePackManager';
import { DigNetwork } from './DigNetwork';
import { Settings } from 'lucide-react';

interface SampleBrowserProps {
  onClose: () => void;
  isLandscape: boolean;
}

import { detectBPM } from '../utils/audioUtils';

const WaveformThumbnail: React.FC<{ buffer?: AudioBuffer; waveform?: number[]; className?: string; color?: string }> = ({
  buffer,
  waveform,
  className = "w-24 h-12",
  color = '#ff1e56'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (waveform) {
      const step = rect.width / waveform.length;
      ctx.beginPath();
      waveform.forEach((peak, i) => {
        const x = i * step;
        const h = peak * (rect.height / 2);
        ctx.moveTo(x, rect.height / 2 - h);
        ctx.lineTo(x, rect.height / 2 + h);
      });
      ctx.stroke();
    } else if (buffer) {
      const data = buffer.getChannelData(0);
      const step = Math.ceil(data.length / rect.width);
      const amp = rect.height / 2;
      ctx.beginPath();
      for (let i = 0; i < rect.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = data[(i * step) + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();
    }
  }, [buffer, waveform, color]);

  return <canvas ref={canvasRef} className={`bg-black/40 rounded border border-white/5 ${className}`} />;
};

const SampleItem: React.FC<{
  meta: SampleMetadata;
  targetPadIndex: number;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSelect: (url: string, name: string) => void;
}> = ({ meta, targetPadIndex, isPlaying, onPlay, onStop, onSelect }) => {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const { audioContext } = useAudioStore();

  useEffect(() => {
    if (!isPlaying && sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) { }
      sourceRef.current = null;
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch (e) { }
      }
      setBuffer(null);
    };
  }, []);

  const togglePreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioContext) return;
    if (isPlaying) { onStop(); return; }
    onPlay();
    let audioBuffer = buffer;
    if (!audioBuffer) {
      try {
        const resp = await fetch(meta.url);
        const arrayBuffer = await resp.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        setBuffer(audioBuffer);
        const bpm = detectBPM(audioBuffer);
        setDetectedBpm(bpm);
      } catch (e) {
        console.error("Preview failed", e);
        onStop();
        return;
      }
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const previewGain = audioContext.createGain();
    previewGain.gain.value = 0.8;
    source.connect(previewGain);
    previewGain.connect(audioContext.destination);
    source.onended = () => { if (sourceRef.current === source) { onStop(); } };
    source.start();
    sourceRef.current = source;
  };

  return (
    <div id={`sample-item-${meta.id}`} className="bg-[#121214] border border-white/5 flex items-center p-3 gap-4 rounded-xl hover:border-retro-accent/40 transition-all shadow-lg">
      <div
        onClick={togglePreview}
        className="w-20 h-14 bg-zinc-900/50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors relative overflow-hidden group"
      >
        {isPlaying ? (
          <Square size={16} className="text-white fill-white shadow-[0_0_10px_white] z-10" />
        ) : (
          <Play size={16} className="text-zinc-500 group-hover:text-white transition-colors z-10" />
        )}
        {(meta.waveform || buffer) && (
          <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity">
            <WaveformThumbnail waveform={meta.waveform} buffer={buffer || undefined} className="w-full h-full" color="#ff1e56" />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <span className="text-[8px] text-zinc-500 uppercase font-extrabold tracking-widest">{meta.bank}</span>
        <span className="font-extrabold text-[11px] uppercase text-zinc-200 truncate tracking-tight">{meta.name}</span>
        {detectedBpm && (
          <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in slide-in-from-left-1 duration-300">
            <div className="w-1 h-1 rounded-full bg-retro-accent animate-pulse" />
            <span className="text-[9px] font-black text-retro-accent italic tracking-tighter uppercase">{detectedBpm} BPM</span>
          </div>
        )}
      </div>

      <button
        onClick={() => onSelect(meta.url, meta.name)}
        className="bg-zinc-800/80 hover:bg-retro-accent text-[9px] uppercase font-extrabold px-4 h-9 rounded-lg border border-white/5 transition-all text-white shadow-md active:scale-95"
      >
        Load Pad
      </button>
    </div>
  );
};

export const SampleBrowser: React.FC<SampleBrowserProps> = ({ onClose, isLandscape }) => {
  const [sampleTab, setSampleTab] = useState<'LIBRARY' | 'DIG'>('LIBRARY');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const [showRecModal, setShowRecModal] = useState(false);
  const [showPackManager, setShowPackManager] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const { selectedPadId, loadSample, sampleLibrary, updatePad, samplePacks, currentSamplePackId, loadSamplePack } = usePadStore();
  const { audioContext, loadSampleToWorklet } = useAudioStore();

  const targetPadIndex = selectedPadId ? parseInt(selectedPadId.split('-')[1]) : 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showRecModal) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showRecModal]);

  const banks = useMemo(() => {
    const b = new Set<string>();
    const query = searchQuery.toLowerCase();
    sampleLibrary.forEach(s => {
      const matchesSearch = s.name.toLowerCase().includes(query) || s.bank.toLowerCase().includes(query);
      if (matchesSearch) b.add(s.bank);
    });
    return Array.from(b).sort();
  }, [sampleLibrary, searchQuery]);

  const allFilteredLibrary = useMemo(() => {
    return sampleLibrary.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.bank.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBank = selectedBank ? s.bank === selectedBank : true;
      return matchesSearch && matchesBank;
    });
  }, [sampleLibrary, searchQuery, selectedBank]);

  const visibleLibrary = useMemo(() => allFilteredLibrary.slice(0, visibleCount), [allFilteredLibrary, visibleCount]);

  const filteredDigItems = useMemo(() => {
    return MOCK_SOCIAL_FEED.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleCount < allFilteredLibrary.length) setVisibleCount(prev => Math.min(prev + 24, allFilteredLibrary.length));
    }, { threshold: 0.1, rootMargin: '300px' });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [allFilteredLibrary.length, visibleCount]);

  const handleSelectSample = async (url: string, name: string) => {
    await loadSample(targetPadIndex, url, name);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioContext) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const sampleId = `user-upload-${Date.now()}`;
      const waveform = generateWaveform(audioBuffer);
      const sampleName = file.name.split('.')[0].toUpperCase();

      loadSampleToWorklet(sampleId, audioBuffer);

      updatePad(targetPadIndex, {
        sampleId,
        buffer: audioBuffer,
        start: 0,
        end: 1,
        viewStart: 0,
        viewEnd: 1
      });

      // Update the centralized samples lookup
      usePadStore.setState(state => ({
        samples: { ...state.samples, [sampleId]: { name: sampleName, waveform } }
      }));

      await dbService.saveSample({ id: sampleId, name: sampleName, data: arrayBuffer, waveform });
      onClose();
    } catch (err) { }
  };

  const handleSaveRecorded = async (buffer: AudioBuffer, name: string) => {
    if (!audioContext) return;
    const sampleId = `rec-${Date.now()}`;
    const waveform = generateWaveform(buffer);

    // Auto Crop Logic
    const data = buffer.getChannelData(0);
    const threshold = 0.02;
    let startIdx = 0;
    let endIdx = data.length - 1;
    for (let i = 0; i < data.length; i++) { if (Math.abs(data[i]) > threshold) { startIdx = i; break; } }
    for (let i = data.length - 1; i >= startIdx; i--) { if (Math.abs(data[i]) > threshold) { endIdx = i; break; } }

    const padding = Math.floor(buffer.sampleRate * 0.03); // Increased to 30ms for safety
    startIdx = Math.max(0, startIdx - padding);
    endIdx = Math.min(data.length - 1, endIdx + padding);
    const startPos = startIdx / data.length;
    const endPos = endIdx / data.length;

    loadSampleToWorklet(sampleId, buffer);
    updatePad(targetPadIndex, {
      sampleId,
      buffer,
      start: startPos,
      end: endPos,
      viewStart: startPos,
      viewEnd: endPos,
      triggerMode: 'GATE'
    });

    // Update the centralized samples lookup
    usePadStore.setState(state => ({
      samples: { ...state.samples, [sampleId]: { name, waveform } }
    }));

    const arrayBuffer = data.buffer.slice(0);
    await dbService.saveSample({ id: sampleId, name: name, data: arrayBuffer, waveform });
    setShowRecModal(false);
    onClose();
  };

  return (
    <div id="sample-browser" className="absolute inset-0 bg-[#0a0a0c] z-50 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {showRecModal && <RecordingModal onClose={() => setShowRecModal(false)} onSave={handleSaveRecorded} />}
      <input id="sample-file-input" type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />

      {/* Top Navbar */}
      <div id="browser-navbar" className="h-6 border-b border-white/5 flex items-stretch bg-[#121214] flex-none">
        <button id="browser-close-btn" onClick={onClose} className="w-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors border-r border-white/5">
          <ChevronLeft size={20} />
        </button>
        <div id="browser-tabs" className="flex-1 flex items-stretch">
          <button
            id="tab-library"
            onClick={() => setSampleTab('LIBRARY')}
            className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-widest transition-all ${sampleTab === 'LIBRARY' ? 'bg-retro-accent text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Music size={14} /> Samples
          </button>
          <button
            id="tab-dig"
            onClick={() => setSampleTab('DIG')}
            className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-widest transition-all ${sampleTab === 'DIG' ? 'bg-retro-accent text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Globe size={14} /> Dig Network
          </button>
        </div>
      </div>

      <div id="browser-scroll-area" className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="max-w-2xl mx-auto px-2 py-2 space-y-2">

          {/* Search Bar & Manager (Library Only) */}
          {sampleTab === 'LIBRARY' && (
            <div id="browser-search-container" className="flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-retro-accent transition-all" size={14} />
                <input
                  id="browser-search-input"
                  type="text"
                  placeholder="Search 1000+ Factory Samples..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-extrabold text-white focus:border-retro-accent/50 focus:bg-zinc-900/80 focus:outline-none transition-all placeholder:text-zinc-700"
                />
              </div>
              <button
                onClick={() => setShowPackManager(true)}
                className="p-2.5 bg-zinc-900/50 border border-white/5 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 flex-none"
                title="Manage Sample Packs"
              >
                <Library size={18} />
              </button>
            </div>
          )}

          {/* Banks Row */}
          {sampleTab === 'LIBRARY' && (
            <div id="library-banks-filter" className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                id="bank-filter-all"
                onClick={() => setSelectedBank(null)}
                className={`px-5 py-2 rounded-full text-[9px] font-extrabold uppercase whitespace-nowrap border transition-all flex-none tracking-widest ${selectedBank === null ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
              >
                All Banks
              </button>
              {banks.map(bank => (
                <button
                  key={bank}
                  id={`bank-filter-${bank}`}
                  onClick={() => setSelectedBank(bank)}
                  className={`px-5 py-2 rounded-full text-[9px] font-extrabold uppercase whitespace-nowrap border transition-all flex-none tracking-widest ${selectedBank === bank ? 'bg-retro-accent text-white border-retro-accent' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
                >
                  {bank}
                </button>
              ))}
            </div>
          )}

          {/* Main Grid/List */}
          {sampleTab === 'LIBRARY' ? (
            <div id="library-content" className="space-y-3">
              {/* Action Tiles */}
              <div id="library-actions" className="grid grid-cols-1 gap-3 mb-6">
                <button
                  id="action-upload"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-900/20 border border-dashed border-white/10 rounded-xl py-8 flex flex-col items-center justify-center gap-2 group hover:border-retro-accent/40 hover:bg-retro-accent/5 transition-all"
                >
                  <Upload size={20} className="text-zinc-600 group-hover:text-retro-accent transition-colors" />
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 group-hover:text-white tracking-[0.2em]">Upload</span>
                </button>
                <button
                  id="action-pro-rec"
                  onClick={() => setShowRecModal(true)}
                  className="bg-zinc-900/20 border border-dashed border-white/10 rounded-xl py-8 flex flex-col items-center justify-center gap-2 group hover:border-retro-accent/40 hover:bg-retro-accent/5 transition-all"
                >
                  <Mic size={20} className="text-zinc-600 group-hover:text-retro-accent transition-colors" />
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 group-hover:text-white tracking-[0.2em]">Pro Rec</span>
                </button>
              </div>

              {/* Sample List */}
              <div id="library-sample-list" className="space-y-2">
                {visibleLibrary.map(item => (
                  <SampleItem
                    key={item.id}
                    meta={item}
                    targetPadIndex={targetPadIndex}
                    isPlaying={playingId === item.id}
                    onPlay={() => setPlayingId(item.id)}
                    onStop={() => setPlayingId(null)}
                    onSelect={handleSelectSample}
                  />
                ))}
              </div>
              {visibleCount < allFilteredLibrary.length && <div id="library-loader" ref={observerTarget} className="w-full py-8 flex items-center justify-center"><Loader2 className="w-6 h-6 text-retro-accent animate-spin" /></div>}
            </div>
          ) : (
            <div id="dig-content" className="space-y-4">
              <DigNetwork targetPadIndex={targetPadIndex} onClose={onClose} />
            </div>
          )}
        </div>
      </div>

      {status && (
        <div id="browser-status-toast" className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-retro-accent text-white text-[10px] font-extrabold uppercase rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 z-[100] glow-red">
          {status}
        </div>
      )}
      {showPackManager && <SamplePackManager onClose={() => setShowPackManager(false)} />}
    </div>
  );
};
