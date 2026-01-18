/**
 * Dig Network Component
 * Real-time social media digging interface with time range selection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Play, Square, Loader2, AlertCircle,
    Youtube, Music2, Globe, Zap, Radio, ExternalLink,
    Disc3, Scissors, Clock, X
} from 'lucide-react';
import { parseUrl, getPlatformColor, getPlatformName, SocialPlatform, ParsedUrl } from '../utils/urlParser';
import { createDigPreview, DigPreviewItem } from '../services/oembedService';
import { extractAudio, ExtractionProgress, checkBackendHealth, searchVideos, SearchResult } from '../services/digService';
import { usePadStore } from '../stores/padStore';
import { useAudioStore } from '../stores/audioStore';
import { dbService } from '../services/dbService';
import { generateWaveform } from '../utils/audioUtils';

interface DigNetworkProps {
    targetPadIndex: number;
    onClose: () => void;
}

// Constants
const MAX_DURATION_SECONDS = 180; // 3 minutes max

// Platform icon mapping
const PlatformIcon: React.FC<{ platform: SocialPlatform; size?: number }> = ({ platform, size = 16 }) => {
    switch (platform) {
        case 'youtube':
            return <Youtube size={size} />;
        case 'tiktok':
        case 'instagram':
        case 'xiaohongshu':
            return <Music2 size={size} />;
        case 'rutube':
            return <Radio size={size} />;
        default:
            return <Globe size={size} />;
    }
};

// Format seconds to MM:SS
const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Parse MM:SS to seconds
const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        const mins = parseInt(parts[0]) || 0;
        const secs = parseInt(parts[1]) || 0;
        return mins * 60 + secs;
    }
    return parseInt(timeStr) || 0;
};

export const DigNetwork: React.FC<DigNetworkProps> = ({ targetPadIndex, onClose }) => {
    const [inputUrl, setInputUrl] = useState('');
    const [parsedUrl, setParsedUrl] = useState<ParsedUrl | null>(null);
    const [preview, setPreview] = useState<DigPreviewItem | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
    const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recentDigs, setRecentDigs] = useState<DigPreviewItem[]>([]);

    // Search results state
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchLimit, setSearchLimit] = useState(15);

    // Time range state
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [showTimeRange, setShowTimeRange] = useState(false);

    // Video player state
    const [showPlayer, setShowPlayer] = useState(false);
    const playerRef = useRef<HTMLIFrameElement>(null);
    const ytPlayerRef = useRef<any>(null);

    // Live Capture state
    const [isCaptureMode, setIsCaptureMode] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);

    const { updatePad } = usePadStore();
    const { audioContext, loadSampleToWorklet } = useAudioStore();
    const inputRef = useRef<HTMLInputElement>(null);

    // Check backend on mount
    useEffect(() => {
        checkBackendHealth().then(setBackendAvailable);
        inputRef.current?.focus();
    }, []);

    // Parse URL when input changes
    useEffect(() => {
        if (!inputUrl.trim()) {
            setParsedUrl(null);
            setPreview(null);
            setError(null);
            setShowTimeRange(false);
            setSearchResults([]);
            setSearchLimit(15);
            return;
        }

        const parsed = parseUrl(inputUrl);
        setParsedUrl(parsed);
        setShowPlayer(false);
        setSearchLimit(15); // Reset limit on new input

        if (parsed.isValid && parsed.platform !== 'unknown') {
            setSearchResults([]);
            const timer = setTimeout(async () => {
                const previewData = await createDigPreview(parsed);
                setPreview(previewData);

                // Use durationSeconds from backend
                if (previewData.durationSeconds) {
                    const duration = previewData.durationSeconds;
                    setVideoDuration(duration);
                    setStartTime(0);
                    // If video is longer than 3 min, default end to 3 min
                    setEndTime(Math.min(duration, MAX_DURATION_SECONDS));
                    setShowTimeRange(duration > 30); // Show range UI for videos > 30s
                }
            }, 300);
            return () => clearTimeout(timer);
        } else if (inputUrl.trim().length >= 3 && !parsed.isValid) {
            // Trigger search if not a valid URL and enough characters
            const timer = setTimeout(async () => {
                if (searchLimit > 15) setIsLoadingMore(true);
                else setIsSearching(true);

                const results = await searchVideos(inputUrl.trim(), 'youtube', searchLimit);
                setSearchResults(results);
                setIsSearching(false);
                setIsLoadingMore(false);
                setPreview(null);
            }, 600);
            return () => clearTimeout(timer);
        } else if (parsed.platform === 'unknown' && parsed.isValid) {
            setSearchResults([]);
            setPreview({
                id: 'unknown',
                platform: 'unknown',
                url: inputUrl,
                title: 'Unknown Platform',
                thumbnail: null,
                isLoading: false,
            });
        }
    }, [inputUrl, searchLimit]);

    // Handle URL paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        setInputUrl(pastedText.trim());
    }, []);

    // External player current time (updated via postMessage)
    const [externalPlayerTime, setExternalPlayerTime] = useState<number>(0);

    // Initialize YouTube Player API when player is shown
    useEffect(() => {
        if (!showPlayer || !preview?.embedUrl || preview.platform !== 'youtube') return;

        // Load YouTube IFrame API if not already loaded
        if (!(window as any).YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        }

        // Wait for API to be ready, then create player
        const initPlayer = () => {
            if (!playerRef.current) return;

            ytPlayerRef.current = new (window as any).YT.Player(playerRef.current, {
                events: {
                    onReady: () => console.log('[YT] Player ready'),
                }
            });
        };

        if ((window as any).YT && (window as any).YT.Player) {
            // Small delay to ensure iframe is mounted
            setTimeout(initPlayer, 500);
        } else {
            (window as any).onYouTubeIframeAPIReady = initPlayer;
        }

        return () => {
            ytPlayerRef.current = null;
        };
    }, [showPlayer, preview?.embedUrl, preview?.platform]);

    // Initialize External Player (Rutube) postMessage listener
    useEffect(() => {
        if (!showPlayer || !preview?.embedUrl || preview.platform !== 'rutube') return;

        const handleMessage = (event: MessageEvent) => {
            if (!event.origin.includes('rutube.ru')) return;

            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                if (data.type === 'player:currentTime' || data.event === 'timeupdate' || data.data?.currentTime !== undefined) {
                    const time = data.data?.currentTime || data.currentTime || data.time;
                    if (typeof time === 'number') {
                        setExternalPlayerTime(Math.floor(time));
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        window.addEventListener('message', handleMessage);

        const requestTimeInterval = setInterval(() => {
            if (playerRef.current?.contentWindow) {
                playerRef.current.contentWindow.postMessage(
                    JSON.stringify({ type: 'player:getState', method: 'getCurrentTime' }),
                    '*'
                );
            }
        }, 500);

        return () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(requestTimeInterval);
        };
    }, [showPlayer, preview?.embedUrl, preview?.platform]);

    // Get current time from player (YouTube, Rutube)
    const getCurrentPlayerTime = useCallback((): number | null => {
        if (preview?.platform === 'youtube') {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                return Math.floor(ytPlayerRef.current.getCurrentTime());
            }
        } else if (preview?.platform === 'rutube') {
            return externalPlayerTime;
        }
        return null;
    }, [preview?.platform, externalPlayerTime]);

    // Set start time from current player position
    const setStartFromPlayer = useCallback(() => {
        const currentTime = getCurrentPlayerTime();
        if (currentTime !== null) {
            handleStartTimeChange(currentTime);
        }
    }, [getCurrentPlayerTime]);

    // Set end time from current player position
    const setEndFromPlayer = useCallback(() => {
        const currentTime = getCurrentPlayerTime();
        if (currentTime !== null) {
            handleEndTimeChange(currentTime);
        }
    }, [getCurrentPlayerTime]);

    // Calculate selected duration
    const selectedDuration = endTime - startTime;
    const isValidRange = selectedDuration > 0 && selectedDuration <= MAX_DURATION_SECONDS;

    // Handle time range slider change
    const handleStartTimeChange = (value: number) => {
        const newStart = Math.max(0, Math.min(value, endTime - 1));
        setStartTime(newStart);
        // Ensure end doesn't exceed max duration from start
        if (endTime - newStart > MAX_DURATION_SECONDS) {
            setEndTime(newStart + MAX_DURATION_SECONDS);
        }
    };

    const handleEndTimeChange = (value: number) => {
        const maxEnd = Math.min(videoDuration, startTime + MAX_DURATION_SECONDS);
        const newEnd = Math.max(startTime + 1, Math.min(value, maxEnd));
        setEndTime(newEnd);
    };

    // --- WebRTC Live Capture Logic ---

    const startLiveCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // video is required for getDisplayMedia
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                } as any
            });

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                setError("No audio track found. Make sure to check 'Share tab audio' in the sharing dialog.");
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            setCaptureStream(stream);

            const mediaRecorder = new MediaRecorder(new MediaStream(audioTracks));
            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                // Use slice(0) to create a copy because decodeAudioData detaches the buffer
                const audioBuffer = await audioContext?.decodeAudioData(arrayBuffer.slice(0));

                if (audioBuffer) {
                    const sampleId = `capture-${Date.now()}`;
                    const waveform = generateWaveform(audioBuffer);
                    const sampleName = `CAPTURE ${new Date().toLocaleTimeString()}`;

                    loadSampleToWorklet(sampleId, audioBuffer);
                    updatePad(targetPadIndex, {
                        sampleId,
                        name: sampleName,
                        buffer: audioBuffer,
                        start: 0,
                        end: 1,
                        viewStart: 0,
                        viewEnd: 1,
                    });

                    usePadStore.setState(state => ({
                        samples: { ...state.samples, [sampleId]: { name: sampleName, waveform } }
                    }));

                    await dbService.saveSample({
                        id: sampleId,
                        name: sampleName,
                        data: arrayBuffer,
                        waveform,
                    });

                    // Cleanup stream
                    stream.getTracks().forEach(t => t.stop());
                    setCaptureStream(null);
                    setIsRecording(false);
                }
            };

            setRecorder(mediaRecorder);
            setError(null);
        } catch (err: any) {
            if (err.name !== 'NotAllowedError') {
                setError("Failed to start capture: " + err.message);
            }
        }
    };

    const toggleRecording = () => {
        if (!recorder) return;

        if (isRecording) {
            recorder.stop();
        } else {
            setRecordedChunks([]);
            recorder.start();
            setIsRecording(true);
        }
    };

    const stopCaptureMode = () => {
        if (captureStream) {
            captureStream.getTracks().forEach(t => t.stop());
        }
        setCaptureStream(null);
        setRecorder(null);
        setIsRecording(false);
        setIsCaptureMode(false);
    };

    // --- End WebRTC Logic ---

    // Extract and load to pad
    const handleDig = useCallback(async () => {
        if (!parsedUrl || !audioContext) return;

        if (!isValidRange) {
            setError(`Selected range must be between 1 second and ${MAX_DURATION_SECONDS / 60} minutes`);
            return;
        }

        setIsExtracting(true);
        setError(null);

        // Pass time range to extraction
        const result = await extractAudio(parsedUrl, setExtractionProgress, {
            startTime: showTimeRange ? startTime : undefined,
            endTime: showTimeRange ? endTime : undefined,
        });

        if (result.success && result.audioBlob) {
            try {
                const arrayBuffer = await result.audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

                const sampleId = `dig-${parsedUrl.platform}-${Date.now()}`;
                const waveform = generateWaveform(audioBuffer);
                const sampleName = (result.title || preview?.title || 'DIG').substring(0, 20).toUpperCase();

                loadSampleToWorklet(sampleId, audioBuffer);

                updatePad(targetPadIndex, {
                    sampleId,
                    name: sampleName,
                    buffer: audioBuffer,
                    start: 0,
                    end: 1,
                    viewStart: 0,
                    viewEnd: 1,
                });

                usePadStore.setState(state => ({
                    samples: { ...state.samples, [sampleId]: { name: sampleName, waveform } }
                }));

                await dbService.saveSample({
                    id: sampleId,
                    name: sampleName,
                    data: arrayBuffer,
                    waveform,
                });

                if (preview) {
                    setRecentDigs(prev => [preview, ...prev.slice(0, 4)]);
                }

                onClose();

            } catch (decodeError) {
                setError('Failed to decode audio. The file may be corrupted.');
            }
        } else {
            setError(result.error || 'Extraction failed');
        }

        setIsExtracting(false);
        setExtractionProgress(null);
    }, [parsedUrl, audioContext, preview, targetPadIndex, updatePad, loadSampleToWorklet, onClose, startTime, endTime, showTimeRange, isValidRange]);

    return (
        <div className="flex flex-col gap-4 h-full min-h-0 px-2 py-2">
            {/* Backend Status */}
            <div className="flex-none flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Disc3 size={14} className="text-retro-accent animate-spin-slow" />
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
                        Dig Network
                    </span>
                </div>
                <div className="flex items-center gap-1.5 focus-within:z-50">
                    <button
                        onClick={() => setIsCaptureMode(!isCaptureMode)}
                        className={`px-2 py-1 rounded-md text-[8px] font-extrabold uppercase tracking-tight transition-all flex items-center gap-1.5 border ${isCaptureMode
                            ? 'bg-retro-accent/20 border-retro-accent text-retro-accent'
                            : 'bg-zinc-800 border-white/5 text-zinc-500 hover:text-zinc-400'
                            }`}
                    >
                        <Disc3 size={10} className={isCaptureMode ? 'animate-spin-slow' : ''} />
                        Live Capture
                    </button>

                    <div className="w-[1px] h-3 bg-white/10 mx-1" />

                    {backendAvailable === null ? (
                        <Loader2 size={10} className="animate-spin text-zinc-500" />
                    ) : backendAvailable ? (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-bold text-emerald-500">ONLINE</span>
                        </>
                    ) : (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="text-[8px] font-bold text-amber-500 uppercase">SERVER OFF</span>
                        </>
                    )}
                </div>
            </div>

            {/* URL Input */}
            <div className="flex-none relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {parsedUrl && parsedUrl.platform !== 'unknown' ? (
                        <div
                            className="p-1 rounded bg-white/5"
                            style={{ color: getPlatformColor(parsedUrl.platform) }}
                        >
                            <PlatformIcon platform={parsedUrl.platform} size={12} />
                        </div>
                    ) : (
                        <Search className="text-zinc-600" size={14} />
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Paste YouTube, TikTok, Instagram, 小红书, Rutube URL..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onPaste={handlePaste}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-[11px] font-bold text-white focus:border-retro-accent/50 focus:outline-none transition-all placeholder:text-zinc-600"
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {isSearching && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 bg-zinc-900/40 border border-white/5 rounded-xl">
                        <Loader2 size={24} className="text-retro-accent animate-spin" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Searching Videos...</span>
                    </div>
                )}

                {searchResults.length > 0 && !preview && !isSearching && (
                    <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex-none flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Search size={12} className="text-zinc-500" />
                                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">
                                    Results on YouTube
                                </span>
                            </div>
                            <span className="text-[8px] font-bold text-zinc-600">{searchResults.length} found</span>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-2">
                            {searchResults.map((result) => (
                                <button
                                    key={result.id + result.url}
                                    onClick={() => setInputUrl(result.url)}
                                    className="w-full flex gap-3 bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-retro-accent/30 p-2 rounded-xl transition-all text-left group"
                                >
                                    <div className="relative flex-none w-24 aspect-video bg-black rounded-lg overflow-hidden border border-white/5">
                                        {result.thumbnail && <img src={result.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />}
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        {result.duration_string && (
                                            <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 text-[8px] font-bold text-white rounded">
                                                {result.duration_string}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 py-0.5">
                                        <h4 className="text-[11px] font-bold text-white leading-tight group-hover:text-retro-accent transition-colors line-clamp-2">
                                            {result.title}
                                        </h4>
                                        <p className="text-[9px] text-zinc-500 font-bold truncate mt-1">{result.uploader}</p>
                                    </div>
                                </button>
                            ))}

                            {searchResults.length > 0 && (
                                <button
                                    onClick={() => setSearchLimit(prev => prev + 15)}
                                    disabled={isLoadingMore}
                                    className="w-full py-4 mt-2 flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 rounded-xl hover:border-retro-accent/40 hover:bg-retro-accent/5 transition-all group"
                                >
                                    {isLoadingMore ? (
                                        <Loader2 size={16} className="text-retro-accent animate-spin" />
                                    ) : (
                                        <span className="text-[9px] font-extrabold uppercase text-zinc-500 group-hover:text-white tracking-[0.2em]">Load More Results</span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {(preview || (!isSearching && searchResults.length === 0)) && (
                    <div className={`flex-1 min-h-0 min-w-0 ${preview ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar pb-10'}`}>
                        {preview && (
                            <div className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {showPlayer && preview.embedUrl ? (
                                    <div className="aspect-video bg-black relative">
                                        <iframe
                                            ref={playerRef}
                                            src={`${preview.embedUrl}${preview.platform === 'youtube' ? '?enablejsapi=1&origin=' + window.location.origin + '&autoplay=1' : '?autoStart=true'}`}
                                            className="w-full h-full border-none"
                                            allow="autoplay; fullscreen; picture-in-picture"
                                            allowFullScreen
                                        />
                                        <button onClick={() => setShowPlayer(false)} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-lg backdrop-blur-md transition-all z-20 border border-white/10">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative aspect-video group cursor-pointer" onClick={() => setShowPlayer(true)}>
                                        <img src={preview.thumbnail} className="w-full h-full object-cover" alt="" />
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                            <div className="w-14 h-14 bg-retro-accent rounded-full flex items-center justify-center text-white shadow-xl shadow-retro-accent/40 group-hover:scale-110 transition-transform duration-300">
                                                <Play size={24} fill="white" className="ml-1" />
                                            </div>
                                            <span className="text-[10px] font-extrabold text-white uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Preview Video</span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-[13px] font-extrabold text-white leading-tight tracking-tight">{preview.title}</h3>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            <span>{preview.uploader}</span>
                                            {preview.duration && <><span className="text-zinc-700">•</span><span>{formatTime(preview.duration)}</span></>}
                                        </div>
                                    </div>

                                    {showTimeRange && videoDuration > 0 && (
                                        <div className="space-y-3 bg-black/40 p-3 rounded-lg border border-white/5">
                                            <div className="relative h-6 flex items-center">
                                                <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full" />
                                                <div className="absolute h-1 bg-retro-accent rounded-full" style={{ left: `${(startTime / videoDuration) * 100}%`, width: `${((endTime - startTime) / videoDuration) * 100}%` }} />
                                                <input type="range" min={0} max={videoDuration} value={startTime} onChange={(e) => handleStartTimeChange(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 z-20 cursor-pointer" style={{ clipPath: 'inset(0 50% 0 0)' }} />
                                                <input type="range" min={0} max={videoDuration} value={endTime} onChange={(e) => handleEndTimeChange(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 z-20 cursor-pointer" style={{ clipPath: 'inset(0 0 0 50%)' }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                                                <span>{formatTime(startTime)}</span>
                                                <span>{formatTime(endTime)}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        {isCaptureMode ? (
                                            <button onClick={startLiveCapture} className="w-full py-3 bg-retro-accent text-white rounded-xl font-extrabold text-[12px] uppercase tracking-widest">Initialize Capture</button>
                                        ) : (
                                            <button onClick={handleDig} disabled={isExtracting || !backendAvailable} className="w-full py-3 bg-retro-accent text-white rounded-xl font-extrabold text-[11px] uppercase shadow-lg shadow-retro-accent/20">
                                                {isExtracting ? 'Extracting...' : `Dig to Pad ${targetPadIndex + 1}`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!preview && searchResults.length === 0 && (
                            <>
                                {recentDigs.length > 0 && (
                                    <div className="space-y-3 px-1">
                                        <h4 className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-600 px-1">Recent Digs</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {recentDigs.map((dig) => (
                                                <button key={dig.id} onClick={() => setInputUrl(dig.url)} className="flex items-center gap-3 bg-zinc-900/40 border border-white/5 p-2 rounded-xl hover:border-retro-accent/30 transition-all text-left group">
                                                    {dig.thumbnail ? <img src={dig.thumbnail} className="w-12 h-12 rounded-lg object-cover" alt="" /> : <div className="w-12 h-12 bg-zinc-800 rounded-lg" />}
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold text-white truncate group-hover:text-retro-accent">{dig.title}</p>
                                                        <p className="text-[8px] text-zinc-500 uppercase">{getPlatformName(dig.platform)}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 px-1">
                                    {(['youtube', 'tiktok', 'instagram', 'rutube'] as SocialPlatform[]).map((p) => (
                                        <div key={p} className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 flex items-center gap-3 opacity-50">
                                            <PlatformIcon platform={p} size={16} />
                                            <span className="text-[10px] font-bold text-zinc-400 capitalize">{p}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
