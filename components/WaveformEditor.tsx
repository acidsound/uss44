import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Scissors, Hash, Clock, MousePointer2, Magnet, Repeat, PlayCircle, Hand, Library, Mic, Music } from 'lucide-react';
import { usePadStore } from '../stores/padStore';
import { useAudioStore } from '../stores/audioStore';
import { useSequencerStore } from '../stores/sequencerStore';
import { TriggerMode, AppMode } from '../types';
import { detectBPM, calculateLoopBPM } from '../utils/audioUtils';

interface WaveformEditorProps {
  isUltraSampleMode?: boolean;
}

export const WaveformEditor: React.FC<WaveformEditorProps> = ({ isUltraSampleMode = false }) => {
  const { currentChannel, selectedPadId, pads, samples, updatePad, stopPad, setAppMode, setRecordingModalOpen } = usePadStore();
  const { audioContext, micAnalyser, isRecording } = useAudioStore();
  const { setBpm } = useSequencerStore();
  const selectedPadIndex = parseInt(selectedPadId.split('-')[1]);
  const activePad = pads[`${currentChannel}-${selectedPadIndex}`];
  const sampleData = activePad?.sampleId ? samples[activePad.sampleId] : null;

  const detectedBpm = useMemo(() => {
    if (activePad?.buffer) {
      const pitch = activePad.pitch || 1.0;
      const sliceDuration = ((activePad.end - activePad.start) * activePad.buffer.duration) / pitch;
      return calculateLoopBPM(sliceDuration);
    }
    return null;
  }, [activePad?.buffer, activePad?.start, activePad?.end, activePad?.pitch]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const animationRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const doubleTapStartXRef = useRef<number | null>(null);

  const [localView, setLocalView] = useState({ start: 0, end: 1 });
  const [rulerMode, setRulerMode] = useState<'TIME' | 'SAMPLES'>('TIME');
  const [selectionMode, setSelectionMode] = useState(false);
  const [autoSnap, setAutoSnap] = useState(true);
  const [tempSelection, setTempSelection] = useState<{ start: number, end: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<'start' | 'end' | 'scroll' | 'ruler' | 'selection' | 'doubleTapCrop' | null>(null);

  const buffer = activePad?.buffer;
  const storedWaveform = sampleData?.waveform;
  const RULER_HEIGHT = 18;
  const HANDLE_WIDTH = 24;
  const HANDLE_HEIGHT = 48;

  useEffect(() => {
    if (activePad) {
      setLocalView({
        start: activePad.viewStart ?? 0,
        end: activePad.viewEnd ?? 1
      });
    }
  }, [selectedPadId, activePad?.viewStart, activePad?.viewEnd]);

  const findNearestSnapPoint = (normalizedPos: number) => {
    if (!buffer) return normalizedPos;
    const data = buffer.getChannelData(0);
    const totalSamples = data.length;
    const centerIdx = Math.floor(normalizedPos * totalSamples);
    const threshold = 0.01;
    const windowSamples = Math.floor(buffer.sampleRate * 0.05);
    const minIdx = Math.max(0, centerIdx - windowSamples);
    const maxIdx = Math.min(totalSamples - 1, centerIdx + windowSamples);
    let nearestIdx = centerIdx;
    let minDistance = Infinity;
    for (let i = minIdx; i < maxIdx; i++) {
      if (Math.abs(data[i]) > threshold) {
        const dist = Math.abs(i - centerIdx);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }
    }
    return nearestIdx / totalSamples;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const waveformHeight = height - RULER_HEIGHT;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Live Monitoring for UltraSample Mode
    if (isUltraSampleMode && micAnalyser) {
      const bufferLength = micAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      micAnalyser.getByteTimeDomainData(dataArray);

      ctx.strokeStyle = '#2d2d30';
      ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = isRecording ? '#ff1e56' : '#00f3ff';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128.0;
        const y = (height / 2) - (v * height / 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Overlay Text
      ctx.fillStyle = isRecording ? '#ff1e56' : '#00f3ff';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(isRecording ? "RECORDING..." : "LIVE INPUT", 10, 20);
      return;
    }

    // Normal Waveform Editor Rendering
    if (!buffer && !storedWaveform) return;

    const { start: viewStart, end: viewEnd } = localView;
    const range = viewEnd - viewStart;
    const totalSamples = buffer ? buffer.getChannelData(0).length : 1000;
    const duration = buffer ? buffer.duration : 1;

    const isInteractingWithRuler = dragTarget === 'ruler' || (selectionMode && dragTarget === 'selection');
    ctx.fillStyle = isInteractingWithRuler ? '#1c1c21' : '#141417';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    ctx.strokeStyle = '#2d2d30';
    ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(width, RULER_HEIGHT); ctx.stroke();

    const drawRuler = () => {
      ctx.font = '8px "Inter", sans-serif';
      ctx.fillStyle = isInteractingWithRuler ? '#999' : '#666';
      ctx.textAlign = 'center';
      const numTicks = 10;
      for (let i = 0; i <= numTicks; i++) {
        const x = (i / numTicks) * width;
        const normalizedPos = viewStart + (i / numTicks) * range;
        ctx.strokeStyle = '#333';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER_HEIGHT); ctx.stroke();
        let label = '';
        if (rulerMode === 'TIME') label = (normalizedPos * duration).toFixed(2) + 's';
        else label = Math.floor(normalizedPos * totalSamples).toLocaleString();
        if (i > 0 && i < numTicks) ctx.fillText(label, x, RULER_HEIGHT - 6);
      }
    };
    drawRuler();

    ctx.save();
    ctx.translate(0, RULER_HEIGHT);
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, waveformHeight);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * width;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, waveformHeight); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, waveformHeight / 2); ctx.lineTo(width, waveformHeight / 2); ctx.stroke();

    // Waveform
    ctx.beginPath();
    ctx.strokeStyle = '#ff3c6a';
    ctx.lineWidth = 1.5;

    if (buffer) {
      const data = buffer.getChannelData(0);
      const startIdx = Math.floor(viewStart * data.length);
      const endIdx = Math.floor(viewEnd * data.length);
      const visibleSamples = endIdx - startIdx;
      for (let x = 0; x < width; x++) {
        const sampleIdx = startIdx + Math.floor((x / width) * visibleSamples);
        if (sampleIdx >= data.length) break;
        const val = data[sampleIdx];
        const y = (0.5 - val * 0.45) * waveformHeight;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else if (storedWaveform) {
      const startIdx = Math.floor(viewStart * storedWaveform.length);
      const endIdx = Math.floor(viewEnd * storedWaveform.length);
      const visiblePoints = endIdx - startIdx;
      for (let x = 0; x < width; x++) {
        const pointIdx = startIdx + Math.floor((x / width) * visiblePoints);
        if (pointIdx >= storedWaveform.length) break;
        const val = storedWaveform[pointIdx];
        const h = val * (waveformHeight / 2) * 0.9;
        ctx.moveTo(x, waveformHeight / 2 - h);
        ctx.lineTo(x, waveformHeight / 2 + h);
      }
    }
    ctx.stroke();

    const padSX = ((activePad.start - viewStart) / range) * width;
    const padEX = ((activePad.end - viewStart) / range) * width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    if (padSX > 0) ctx.fillRect(0, 0, Math.min(width, padSX), waveformHeight);
    if (padEX < width) ctx.fillRect(Math.max(0, padEX), 0, width - padEX, waveformHeight);

    if (tempSelection) {
      const sX = ((tempSelection.start - viewStart) / range) * width;
      const eX = ((tempSelection.end - viewStart) / range) * width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      const startX = Math.min(sX, eX);
      const widthX = Math.abs(eX - sX);
      ctx.fillRect(startX, -RULER_HEIGHT, widthX, height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, -RULER_HEIGHT, widthX, height);
      ctx.setLineDash([]);
    }

    const drawMarker = (pos: number, color: string, label: string, isEnd: boolean = false) => {
      if (pos < viewStart && pos + (isEnd ? 0 : (HANDLE_WIDTH / width) * range) < viewStart) return;
      if (pos > viewEnd && pos - (isEnd ? (HANDLE_WIDTH / width) * range : 0) > viewEnd) return;

      const x = ((pos - viewStart) / range) * width;

      // Marker Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, waveformHeight); ctx.stroke();

      // Handle Tab
      ctx.fillStyle = color;
      const handleY = isEnd ? waveformHeight - HANDLE_HEIGHT - 5 : 5;
      const handleX = isEnd ? x - HANDLE_WIDTH : x;

      // Draw tab background
      ctx.beginPath();
      if (isEnd) {
        // Rounded handle on the left for END
        ctx.roundRect(handleX, handleY, HANDLE_WIDTH, HANDLE_HEIGHT, [8, 0, 0, 8]);
      } else {
        // Rounded handle on the right for START
        ctx.roundRect(handleX, handleY, HANDLE_WIDTH, HANDLE_HEIGHT, [0, 8, 8, 0]);
      }
      ctx.fill();

      // Label on handle
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(handleX + HANDLE_WIDTH / 2, handleY + HANDLE_HEIGHT / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(label, 0, 3);
      ctx.restore();
    };

    drawMarker(activePad.start, '#00ffcc', 'START');
    drawMarker(activePad.end, '#ffdd00', 'END', true);

    if (audioContext && activePad.lastTriggerTime !== undefined && activePad.lastTriggerDuration !== undefined) {
      const now = audioContext.currentTime;
      const elapsed = now - activePad.lastTriggerTime;
      let shouldDraw = false;

      // Determine if playhead should be visible based on trigger mode and stop time
      if (activePad.triggerMode === 'ONE_SHOT') {
        // ONE_SHOT: always plays to completion regardless of release
        shouldDraw = elapsed >= 0 && elapsed <= activePad.lastTriggerDuration;
      } else if (activePad.triggerMode === 'GATE' || activePad.triggerMode === 'LOOP') {
        // GATE/LOOP: respect manual release and scheduled stop time
        if (activePad.isHeld) {
          // Still being held (manual trigger) - show playhead
          shouldDraw = elapsed >= 0;
        } else if (activePad.lastStopTime !== undefined) {
          // Released or scheduled stop - show until stop time
          shouldDraw = elapsed >= 0 && now <= activePad.lastStopTime;
        }
      }

      if (shouldDraw) {
        let progress = elapsed / activePad.lastTriggerDuration;
        if (activePad.triggerMode === 'LOOP') progress = progress % 1;

        const currentPosNormalized = activePad.start + (activePad.end - activePad.start) * progress;
        if (currentPosNormalized >= viewStart && currentPosNormalized <= viewEnd) {
          const x = ((currentPosNormalized - viewStart) / range) * width;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 4; ctx.shadowColor = '#fff';
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, waveformHeight); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
    ctx.restore();
  };

  useEffect(() => {
    const loop = () => { draw(); animationRef.current = requestAnimationFrame(loop); };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [buffer, storedWaveform, localView, activePad, rulerMode, dragTarget, tempSelection, selectionMode, audioContext, isUltraSampleMode, micAnalyser, isRecording]);

  const startDragging = (clientX: number, clientY: number) => {
    if (isUltraSampleMode) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const now = Date.now();
    const isDoubleTap = (now - lastClickTimeRef.current) < 300;
    lastClickTimeRef.current = now;
    lastXRef.current = clientX;
    lastYRef.current = clientY;
    const range = localView.end - localView.start;
    const normalizedX = localView.start + (x / rect.width) * range;

    if (isDoubleTap) {
      updatePad(selectedPadIndex, { start: localView.start, end: localView.end });
      setDragTarget('doubleTapCrop');
      doubleTapStartXRef.current = normalizedX;
      return;
    }
    if (selectionMode) {
      setDragTarget('selection');
      setTempSelection({ start: normalizedX, end: normalizedX });
      return;
    }
    if (y < RULER_HEIGHT) { setDragTarget('ruler'); return; }

    const markerX_Start = ((activePad.start - localView.start) / range) * rect.width;
    const markerX_End = ((activePad.end - localView.start) / range) * rect.width;
    const waveformY = y - RULER_HEIGHT;

    const isNearStartLine = Math.abs(x - markerX_Start) < 20;
    const isInStartHandle = x >= markerX_Start && x <= markerX_Start + HANDLE_WIDTH && waveformY >= 5 && waveformY <= 5 + HANDLE_HEIGHT;

    const isNearEndLine = Math.abs(x - markerX_End) < 20;
    const isInEndHandle = x >= markerX_End - HANDLE_WIDTH && x <= markerX_End && waveformY >= (rect.height - RULER_HEIGHT - HANDLE_HEIGHT - 5) && waveformY <= (rect.height - RULER_HEIGHT - 5);

    if (isInStartHandle || isNearStartLine) setDragTarget('start');
    else if (isInEndHandle || isNearEndLine) setDragTarget('end');
    else setDragTarget('scroll');
  };

  const moveDragging = (clientX: number, clientY: number) => {
    if (!dragTarget || isUltraSampleMode) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const width = rect.width;
    const range = localView.end - localView.start;
    const deltaX = clientX - lastXRef.current;
    const deltaY = clientY - lastYRef.current;
    lastXRef.current = clientX; lastYRef.current = clientY;
    const x = clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, localView.start + (x / width) * range));

    if (dragTarget === 'doubleTapCrop' && doubleTapStartXRef.current !== null) {
      const s = Math.min(doubleTapStartXRef.current, normalizedX);
      const e = Math.max(doubleTapStartXRef.current, normalizedX);
      updatePad(selectedPadIndex, { start: s, end: Math.max(s + 0.001, e) });
    } else if (dragTarget === 'selection' && tempSelection) {
      setTempSelection({ ...tempSelection, end: normalizedX });
    } else if (dragTarget === 'start') {
      updatePad(selectedPadIndex, { start: Math.min(normalizedX, activePad.end - 0.001) });
    } else if (dragTarget === 'end') {
      updatePad(selectedPadIndex, { end: Math.max(normalizedX, activePad.start + 0.001) });
    } else if (dragTarget === 'scroll' || dragTarget === 'ruler') {
      const normalizedDeltaX = (deltaX / width) * range;
      if (dragTarget === 'scroll') {
        const zoomFactor = 1 + (deltaY * 0.01);
        const center = (localView.start + localView.end) / 2;
        const newRange = range * zoomFactor;
        if (newRange > 0.0001 && newRange <= 1) {
          const halfNewRange = newRange / 2;
          let newStart = center - halfNewRange - normalizedDeltaX;
          let newEnd = center + halfNewRange - normalizedDeltaX;
          if (newStart < 0) { newStart = 0; newEnd = newRange; }
          if (newEnd > 1) { newEnd = 1; newStart = 1 - newRange; }
          setLocalView({ start: Math.max(0, Math.min(1 - 0.0001, newStart)), end: Math.max(newStart + 0.0001, Math.min(1, newEnd)) });
          return;
        }
      }
      let nextStart = localView.start - normalizedDeltaX;
      let nextEnd = localView.end - normalizedDeltaX;
      if (nextStart < 0) { nextStart = 0; nextEnd = range; }
      if (nextEnd > 1) { nextEnd = 1; nextStart = 1 - range; }
      setLocalView({ start: Math.max(0, Math.min(1 - 0.0001, nextStart)), end: Math.max(nextStart + 0.0001, Math.min(1, nextEnd)) });
    }
  };

  const handleDragEnd = () => {
    if (isUltraSampleMode) return;
    if (dragTarget === 'doubleTapCrop') { doubleTapStartXRef.current = null; }
    else if (dragTarget === 'selection' && tempSelection) {
      const start = Math.min(tempSelection.start, tempSelection.end);
      const end = Math.max(tempSelection.start, tempSelection.end);
      if (end - start > 0.0005) { setLocalView({ start, end }); updatePad(selectedPadIndex, { viewStart: start, viewEnd: end }); }
      setTempSelection(null); setSelectionMode(false);
    } else if (autoSnap && (dragTarget === 'start' || dragTarget === 'end')) {
      if (dragTarget === 'start') { const snapped = findNearestSnapPoint(activePad.start); updatePad(selectedPadIndex, { start: Math.min(snapped, activePad.end - 0.001) }); }
      else { const snapped = findNearestSnapPoint(activePad.end); updatePad(selectedPadIndex, { end: Math.max(snapped, activePad.start + 0.001) }); }
    } else if (dragTarget === 'scroll' || dragTarget === 'ruler') { updatePad(selectedPadIndex, { viewStart: localView.start, viewEnd: localView.end }); }
    setDragTarget(null);
  };

  const zoomIn = () => {
    const range = localView.end - localView.start;
    const center = (localView.start + localView.end) / 2;
    const newRange = range * 0.5;
    if (newRange < 0.0001) return;
    const nextView = { start: Math.max(0, center - newRange / 2), end: Math.min(1, center + newRange / 2) };
    setLocalView(nextView); updatePad(selectedPadIndex, { viewStart: nextView.start, viewEnd: nextView.end });
  };

  const zoomOut = () => {
    const range = localView.end - localView.start;
    if (range >= 1) return;
    const center = (localView.start + localView.end) / 2;
    const newRange = Math.min(1, range * 2);
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    if (newStart < 0) { newStart = 0; newEnd = newRange; }
    else if (newEnd > 1) { newEnd = 1; newStart = 1 - newRange; }
    const nextView = { start: newStart, end: newEnd };
    setLocalView(nextView); updatePad(selectedPadIndex, { viewStart: nextView.start, viewEnd: nextView.end });
  };

  const autoCrop = () => {
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const threshold = 0.02;
    let start = 0; let end = data.length - 1;
    for (let i = 0; i < data.length; i++) { if (Math.abs(data[i]) > threshold) { start = i; break; } }
    for (let i = data.length - 1; i >= 0; i--) { if (Math.abs(data[i]) > threshold) { end = i; break; } }
    const startPos = start / data.length;
    const endPos = end / data.length;
    updatePad(selectedPadIndex, { start: startPos, end: endPos, viewStart: startPos, viewEnd: endPos });
    setLocalView({ start: startPos, end: endPos });
  };

  const setTriggerMode = (mode: TriggerMode) => {
    if (activePad?.triggerMode === 'ONE_SHOT' && mode !== 'ONE_SHOT') {
      stopPad(selectedPadIndex);
    }
    updatePad(selectedPadIndex, { triggerMode: mode });
  };

  if (!isUltraSampleMode && !activePad?.sampleId && !storedWaveform) {
    return (
      <div id="waveform-empty-state" className="h-full w-full flex items-center justify-center p-2 bg-black/40">
        <div className="w-full h-full min-h-32 flex flex-col items-center justify-center gap-6 border-2 border-dashed border-white/5 rounded-2xl bg-zinc-900/10 p-4">
          <div className="flex flex-col items-center gap-2 opacity-40">
            <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center border border-white/5">
              <Music size={18} className="text-zinc-500" />
            </div>
            <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">
              Idle Buffer
            </span>
          </div>

          <div className="flex flex-row gap-2.5 w-full max-w-[420px]">
            <button
              id="empty-state-browse"
              onClick={() => setAppMode(AppMode.SAMPLE)}
              className="flex-1 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-xl py-3 px-3 flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-95 group overflow-hidden"
            >
              <Library size={16} className="text-zinc-500 group-hover:text-retro-accent transition-colors flex-none" />
              <div className="flex flex-col items-start leading-none gap-1 min-w-0">
                <span className="text-[9px] xs:text-[10px] font-black uppercase tracking-wider truncate w-full text-left">Library</span>
                <span className="text-[7px] font-bold text-zinc-500 uppercase truncate w-full text-left">1000+ SAMPLES</span>
              </div>
            </button>

            <button
              id="empty-state-record"
              onClick={() => setRecordingModalOpen(true)}
              className="flex-1 bg-zinc-800/80 hover:bg-retro-accent/10 hover:border-retro-accent/30 text-white rounded-xl py-3 px-3 flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-95 group overflow-hidden"
            >
              <Mic size={16} className="text-zinc-500 group-hover:text-retro-accent transition-colors flex-none" />
              <div className="flex flex-col items-start leading-none gap-1 min-w-0">
                <span className="text-[9px] xs:text-[10px] font-black uppercase tracking-wider truncate w-full text-left">Record</span>
                <span className="text-[7px] font-bold text-zinc-500 uppercase truncate w-full text-left">INPUT CAPTURE</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="waveform-editor" className="h-full flex flex-col min-h-32 bg-black">
      <div id="waveform-toolbar" className="h-7 border-b border-zinc-800 flex items-center justify-between px-1 bg-[#1a1a1c] flex-none">
        <div id="waveform-tools-left" className="flex items-stretch h-full overflow-x-auto no-scrollbar">
          {!isUltraSampleMode && (
            <>
              <button id="btn-zoom-in" onClick={zoomIn} className="px-2 text-zinc-400 hover:text-white transition-colors" title="Zoom In"><ZoomIn size={12} /></button>
              <button id="btn-zoom-out" onClick={zoomOut} className="px-2 text-zinc-400 hover:text-white transition-colors border-r border-zinc-800" title="Zoom Out"><ZoomOut size={12} /></button>

              <div id="trigger-mode-selectors" className="flex items-stretch border-r border-zinc-800 bg-black/20">
                <button
                  id="mode-oneshot"
                  onClick={() => setTriggerMode('ONE_SHOT')}
                  className={`px-1 flex items-center gap-1 text-[7px] font-bold uppercase transition-colors ${activePad?.triggerMode === 'ONE_SHOT' ? 'text-retro-accent bg-retro-accent/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="One-shot Mode"
                >
                  <PlayCircle size={10} /> Oneshot
                </button>
                <button
                  id="mode-gate"
                  onClick={() => setTriggerMode('GATE')}
                  className={`px-1 flex items-center gap-1 text-[7px] font-bold uppercase transition-colors border-l border-zinc-800/50 ${activePad?.triggerMode === 'GATE' ? 'text-retro-accent bg-retro-accent/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Gate Mode"
                >
                  <Hand size={10} /> Gate
                </button>
                <button
                  id="mode-loop"
                  onClick={() => setTriggerMode('LOOP')}
                  className={`px-1 flex items-center gap-1 text-[7px] font-bold uppercase transition-colors border-l border-zinc-800/50 ${activePad?.triggerMode === 'LOOP' ? 'text-retro-accent bg-retro-accent/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Loop Mode"
                >
                  <Repeat size={10} /> Loop
                </button>
              </div>

              <button id="btn-select-range" onClick={() => setSelectionMode(!selectionMode)} className={`px-1 flex items-center gap-1 text-[8px] font-bold uppercase transition-colors ${selectionMode ? 'bg-retro-accent text-white' : 'text-zinc-400 hover:text-white'}`}><MousePointer2 size={10} /><span className="hidden xs:inline">Select Range</span></button>
            </>
          )}
          {isUltraSampleMode && (
            <span className="px-1 flex items-center text-[10px] text-retro-accent font-black uppercase tracking-wider animate-pulse">
              Microphone Active
            </span>
          )}
        </div>
        <div id="waveform-tools-right" className="flex items-stretch h-full">
          {activePad?.triggerMode === 'LOOP' && detectedBpm && (
            <div
              id="detected-bpm-display"
              onClick={() => setBpm(detectedBpm)}
              className="px-1 flex items-center gap-1 border-l border-zinc-800 bg-retro-accent/5 animate-in fade-in slide-in-from-right-2 duration-500 cursor-pointer hover:bg-retro-accent/10 active:scale-95 transition-all group/bpm"
              title="Click to sync project tempo"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-retro-accent animate-pulse shadow-[0_0_8px_rgba(255,30,86,0.6)] group-hover/bpm:scale-125 transition-transform" />
              <span className="text-[10px] font-black text-white italic tracking-tighter uppercase whitespace-nowrap">
                {detectedBpm}
              </span>
              <span className="text-retro-accent text-[8px] not-italic group-hover/bpm:text-white transition-colors">BPM</span>
            </div>
          )}
          {!isUltraSampleMode && (
            <button
              id="btn-toggle-snap"
              onClick={() => setAutoSnap(!autoSnap)}
              className={`px-2 border-l border-zinc-800 transition-colors flex items-center gap-1 text-[8px] font-bold uppercase ${autoSnap ? 'text-retro-accent bg-retro-accent/5' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Zero-Crossing Snap"
            >
              <Magnet size={10} />
              <span className="hidden sm:inline">Snap</span>
            </button>
          )}
          <button id="btn-toggle-ruler" onClick={() => setRulerMode(rulerMode === 'TIME' ? 'SAMPLES' : 'TIME')} className="px-2 border-l border-zinc-800 hover:text-white transition-colors flex items-center gap-1 text-[8px] font-bold uppercase text-zinc-400">
            {rulerMode === 'TIME' ? <Clock size={10} /> : <Hash size={10} />}
            <span className="hidden sm:inline">{rulerMode}</span>
          </button>
          {!isUltraSampleMode && <button id="btn-autocrop" onClick={autoCrop} className="px-2 border-l border-zinc-800 text-retro-accent hover:text-white transition-colors" title="Auto Crop"><Scissors size={12} /></button>}
        </div>
      </div>
      <div
        id="waveform-canvas-container"
        ref={containerRef}
        className={`px-4 flex-1 relative group overflow-hidden bg-black touch-none min-h-32 ${!isUltraSampleMode && selectionMode ? 'cursor-crosshair' : dragTarget === 'ruler' ? 'cursor-col-resize' : dragTarget === 'doubleTapCrop' ? 'cursor-crosshair' : dragTarget === 'scroll' ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(e) => startDragging(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDragging(e.clientX, e.clientY)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => startDragging(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => moveDragging(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
      >
        <canvas id="waveform-canvas" ref={canvasRef} className="w-full h-full block min-h-32" />
      </div>
    </div>
  );
};
