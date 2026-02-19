/**
 * Dig Network Component
 * Real-time social media digging interface with time range selection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Play, Square, Loader2, AlertCircle,
    Youtube, Music2, Globe, Zap, Radio, ExternalLink,
    Disc3, Scissors, Clock, X, Repeat, ChevronRight, Settings2,
    LayoutGrid, ChevronDown
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
    const [canAutoCapture] = useState(() => !!navigator.mediaDevices?.getDisplayMedia);
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

    // Manual Capture state
    const [isManualMode, setIsManualMode] = useState(!navigator.mediaDevices?.getDisplayMedia);
    const [isRecording, setIsRecording] = useState(false);
    const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);

    const { updatePad } = usePadStore();
    const { audioContext, loadSampleToWorklet } = useAudioStore();
    const inputRef = useRef<HTMLInputElement>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);

    // Range Playback state
    const [isPlayingRange, setIsPlayingRange] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    // Pad Selection state
    const [selectedPadIndex, setSelectedPadIndex] = useState(targetPadIndex);
    const [showPadSelector, setShowPadSelector] = useState(false);

    // Automated Capture state
    const [isAutomatedCapturing, setIsAutomatedCapturing] = useState(false);
    const [showMobileGuidance, setShowMobileGuidance] = useState(false);

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

    // YouTube Player Polling
    useEffect(() => {
        if (!showPlayer || !preview?.embedUrl || preview.platform !== 'youtube') {
            setExternalPlayerTime(0);
            return;
        }

        const pollInterval = setInterval(() => {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                try {
                    const time = ytPlayerRef.current.getCurrentTime();
                    if (typeof time === 'number') {
                        setExternalPlayerTime(time);

                        // Range Playback Monitoring
                        if (isPlayingRange) {
                            if (time >= endTime) {
                                if (isLooping && !isAutomatedCapturing) {
                                    ytPlayerRef.current.seekTo(startTime, true);
                                } else {
                                    ytPlayerRef.current.pauseVideo();
                                    setIsPlayingRange(false);

                                    // Stop automated capture if active
                                    if (isAutomatedCapturing && recorderRef.current && recorderRef.current.state === 'recording') {
                                        recorderRef.current.stop();
                                        setIsAutomatedCapturing(false);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore errors if player is not fully ready
                }
            }
        }, 100);

        return () => clearInterval(pollInterval);
    }, [showPlayer, preview?.embedUrl, preview?.platform, isPlayingRange, isLooping, startTime, endTime]);

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

            // Destroy existing player if any
            if (ytPlayerRef.current) {
                try { ytPlayerRef.current.destroy(); } catch (e) { }
            }

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
        return externalPlayerTime > 0 ? externalPlayerTime : null;
    }, [externalPlayerTime]);

    // Seek player to a specific time
    const seekTo = useCallback((seconds: number) => {
        if (preview?.platform === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(seconds, true);
        } else if (preview?.platform === 'rutube' && playerRef.current?.contentWindow) {
            playerRef.current.contentWindow.postMessage(
                JSON.stringify({ type: 'player:setCurrentTime', data: { currentTime: seconds } }),
                '*'
            );
        }
    }, [preview?.platform]);

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

    const seekToStart = useCallback(() => seekTo(startTime), [seekTo, startTime]);
    const seekToEnd = useCallback(() => seekTo(endTime), [seekTo, endTime]);

    const toggleRangePlay = useCallback(() => {
        if (!showPlayer) {
            setShowPlayer(true);
            setIsPlayingRange(true);
            setTimeout(() => {
                seekTo(startTime);
                if (ytPlayerRef.current?.playVideo) ytPlayerRef.current.playVideo();
            }, 800);
            return;
        }

        // Always jump to start when Play is clicked (if not already playing range or if explicitly requested)
        seekTo(startTime);
        if (ytPlayerRef.current?.playVideo) ytPlayerRef.current.playVideo();
        setIsPlayingRange(true);
    }, [showPlayer, startTime, seekTo]);

    const stopRangePlay = useCallback(() => {
        if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
        setIsPlayingRange(false);
    }, []);

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
        if (showPlayer) seekTo(newStart);
    };

    const handleEndTimeChange = (value: number) => {
        const maxEnd = Math.min(videoDuration, startTime + MAX_DURATION_SECONDS);
        const newEnd = Math.max(startTime + 1, Math.min(value, maxEnd));
        setEndTime(newEnd);
        if (showPlayer) seekTo(newEnd);
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
                    updatePad(selectedPadIndex, {
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
            recorderRef.current = mediaRecorder;
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
        setIsManualMode(false);
    };

    // --- End WebRTC Logic ---

    // Automated Dig (Capture + Load)
    const handleAutomatedDig = useCallback(async () => {
        if (!showPlayer || !preview || !audioContext) return;

        try {
            setError(null);
            setIsExtracting(true);
            setExtractionProgress({ percent: 0, status: 'Initializing Capture...' });

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
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
                setIsExtracting(false);
                return;
            }

            setCaptureStream(stream);
            setIsAutomatedCapturing(true);

            const mediaRecorder = new MediaRecorder(new MediaStream(audioTracks));
            const chunks: Blob[] = [];
            recorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                setExtractionProgress({ percent: 100, status: 'Processing Audio...' });
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

                if (audioBuffer) {
                    const sampleId = `dig-${preview.platform}-${Date.now()}`;
                    const waveform = generateWaveform(audioBuffer);
                    const sampleName = preview.title.substring(0, 20).toUpperCase();

                    loadSampleToWorklet(sampleId, audioBuffer);
                    updatePad(selectedPadIndex, {
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

                    setRecentDigs(prev => [preview, ...prev.slice(0, 4)]);
                    onClose();
                }

                // Cleanup stream
                stream.getTracks().forEach(t => t.stop());
                setCaptureStream(null);
                setIsExtracting(false);
                setIsAutomatedCapturing(false);
            };

            // Prepare Playback
            if (ytPlayerRef.current?.seekTo) {
                ytPlayerRef.current.seekTo(startTime, true);
            }

            // Start recording and playing
            mediaRecorder.start();
            if (ytPlayerRef.current?.playVideo) {
                ytPlayerRef.current.playVideo();
                setIsPlayingRange(true);
            }

            setExtractionProgress({ percent: 0, status: 'Capturing Audio...' });

        } catch (err: any) {
            if (err.name !== 'NotAllowedError') {
                setError(err.message || 'Capture failed');
            }
            setIsExtracting(false);
        }
    }, [showPlayer, preview, audioContext, startTime, endTime, selectedPadIndex, updatePad, loadSampleToWorklet, onClose, setError, setIsExtracting, setExtractionProgress, setCaptureStream, setIsAutomatedCapturing, recorderRef, setRecentDigs, setIsPlayingRange]);

    // Extract and load to pad (Keep for non-YT platforms or as fallback)
    const handleDig = useCallback(async () => {
        // Fallback Guidance for unsupported browsers (Mobile-like experience)
        if (!canAutoCapture) {
            setShowMobileGuidance(true);
            return;
        }

        // Redirect YouTube/Rutube to automated capture for best UX/Quality
        if (preview?.platform === 'youtube' || preview?.platform === 'rutube') {
            handleAutomatedDig();
            return;
        }

        if (!parsedUrl || !audioContext) return;
        // ... rest of handleDig ...

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

                updatePad(selectedPadIndex, {
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
    }, [parsedUrl, audioContext, preview, selectedPadIndex, updatePad, loadSampleToWorklet, onClose, startTime, endTime, showTimeRange, isValidRange, handleAutomatedDig]);

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
                        onClick={() => {
                            if (canAutoCapture) {
                                setIsManualMode(!isManualMode);
                            }
                        }}
                        disabled={!canAutoCapture}
                        className={`px-2 py-1 rounded-md text-[8px] font-extrabold uppercase tracking-tight transition-all flex items-center gap-1.5 border ${!isManualMode
                            ? 'bg-retro-accent/20 border-retro-accent text-retro-accent'
                            : 'bg-zinc-800 border-white/5 text-zinc-500 hover:text-zinc-400'
                            } ${!canAutoCapture ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!canAutoCapture ? "Auto Capture not supported" : isManualMode ? "Switch to Automated Mode" : "Switch to Manual Capture"}
                    >
                        <Zap size={10} className={!isManualMode && canAutoCapture ? 'animate-pulse' : ''} />
                        Auto Capture
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
                    <div className={`flex-1 min-h-0 min-w-0 ${preview ? '' : 'overflow-y-auto no-scrollbar pb-10'}`}>
                        {preview && (
                            <div className="bg-zinc-900/80 border border-white/5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
                                {showPlayer && preview.embedUrl ? (
                                    <div className={`aspect-video bg-black relative ${showPadSelector ? 'pointer-events-none' : ''}`}>
                                        <iframe
                                            ref={playerRef}
                                            src={`${preview.embedUrl}${preview.platform === 'youtube' ? '?enablejsapi=1&origin=' + window.location.origin + '&autoplay=1' : '?autoStart=true'}`}
                                            className="w-full h-full border-none rounded-t-xl"
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
                                            {preview.uploader && <span>{preview.uploader}</span>}
                                            {preview.duration && !isNaN(preview.duration) && preview.duration > 0 && (
                                                <>
                                                    <span className="text-zinc-700">•</span>
                                                    <span>{formatTime(preview.duration)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {showTimeRange && videoDuration > 0 && (
                                        <div className="space-y-3 bg-black/40 p-3 rounded-lg border border-white/5">
                                            <div className="relative h-6 flex items-center">
                                                <div className="absolute inset-x-0 h-1 bg-zinc-800 rounded-full" />
                                                <div className="absolute h-1 bg-retro-accent/40 rounded-full" style={{ left: `${(startTime / videoDuration) * 100}%`, width: `${((endTime - startTime) / videoDuration) * 100}%` }} />

                                                {/* Start/End Markers */}
                                                <div className="absolute h-3 w-1 bg-retro-accent shadow-[0_0_5px_rgba(234,76,137,0.5)] z-10" style={{ left: `${(startTime / videoDuration) * 100}%` }} />
                                                <div className="absolute h-3 w-1 bg-retro-accent shadow-[0_0_5px_rgba(234,76,137,0.5)] z-10" style={{ left: `${(endTime / videoDuration) * 100}%` }} />

                                                {/* Playhead Marker */}
                                                {(showPlayer || externalPlayerTime > 0) && (
                                                    <div
                                                        className="absolute h-5 w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-30 transition-all duration-100 ease-linear pointer-events-none"
                                                        style={{ left: `${(externalPlayerTime / videoDuration) * 100}%` }}
                                                    />
                                                )}

                                                <input type="range" min={0} max={videoDuration} value={startTime} onChange={(e) => handleStartTimeChange(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 z-20 cursor-pointer" style={{ clipPath: 'inset(0 50% 0 0)' }} />
                                                <input type="range" min={0} max={videoDuration} value={endTime} onChange={(e) => handleEndTimeChange(Number(e.target.value))} className="absolute inset-0 w-full opacity-0 z-20 cursor-pointer" style={{ clipPath: 'inset(0 0 0 50%)' }} />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <div
                                                        onClick={seekToStart}
                                                        className="flex flex-col cursor-pointer group/time px-1 hover:bg-white/5 rounded transition-colors"
                                                        title="Seek to Start"
                                                    >
                                                        <span className="text-[7px] text-zinc-600 font-extrabold uppercase group-hover/time:text-retro-accent transition-colors">Start</span>
                                                        <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover/time:text-white transition-colors">{formatTime(startTime)}</span>
                                                    </div>
                                                    <button onClick={setStartFromPlayer} className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded text-[7px] font-extrabold uppercase transition-all border border-white/5 ml-1">
                                                        Set
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={toggleRangePlay}
                                                        className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all group/play"
                                                        title="Play Range from Start"
                                                    >
                                                        <Play size={16} fill="currentColor" className="ml-0.5 group-hover/play:scale-110 transition-transform" />
                                                    </button>

                                                    {isPlayingRange && (
                                                        <button
                                                            onClick={stopRangePlay}
                                                            className="w-10 h-10 rounded-full flex items-center justify-center bg-retro-accent text-white shadow-[0_0_15px_rgba(234,76,137,0.4)] transition-all hover:scale-110"
                                                            title="Stop Range Playback"
                                                        >
                                                            <Square size={16} fill="white" />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => setIsLooping(!isLooping)}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${isLooping
                                                            ? 'text-retro-accent bg-retro-accent/10 border-retro-accent/30 shadow-[0_0_10px_rgba(234,76,137,0.2)]'
                                                            : 'text-zinc-600 bg-zinc-900/50 border-white/5 hover:text-zinc-400 hover:bg-zinc-800'
                                                            }`}
                                                        title={isLooping ? "Disable Loop" : "Enable Loop"}
                                                    >
                                                        <Repeat size={14} className={isLooping ? 'animate-spin-slow' : ''} />
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-1.5 text-right">
                                                    <button onClick={setEndFromPlayer} className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded text-[7px] font-extrabold uppercase transition-all border border-white/5 mr-1">
                                                        Set
                                                    </button>
                                                    <div
                                                        onClick={seekToEnd}
                                                        className="flex flex-col cursor-pointer group/time px-1 hover:bg-white/5 rounded transition-colors text-right"
                                                        title="Seek to End"
                                                    >
                                                        <span className="text-[7px] text-zinc-600 font-extrabold uppercase group-hover/time:text-retro-accent transition-colors">End</span>
                                                        <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover/time:text-white transition-colors">{formatTime(endTime)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="relative flex flex-col gap-2">
                                        {isManualMode ? (
                                            <button onClick={startLiveCapture} className="w-full py-3 bg-retro-accent text-white rounded-xl font-extrabold text-[12px] uppercase tracking-widest">Initialize Capture</button>
                                        ) : (
                                            <div className="relative group">
                                                <button
                                                    onClick={handleDig}
                                                    disabled={isExtracting || !backendAvailable}
                                                    className="w-full py-4 bg-retro-accent text-white rounded-xl font-extrabold text-[12px] uppercase shadow-lg shadow-retro-accent/30 hover:shadow-retro-accent/50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isExtracting ? (
                                                        <>
                                                            <Loader2 size={16} className="animate-spin" />
                                                            <span>{extractionProgress?.status || 'Extracting...'}</span>
                                                        </>
                                                    ) : (
                                                        <span>Dig to Pad {selectedPadIndex + 1}</span>
                                                    )}
                                                </button>

                                                {isExtracting && extractionProgress?.status.includes('Capture') && (
                                                    <div className="absolute -top-6 left-0 right-0 text-center animate-pulse">
                                                        <span className="text-[9px] font-bold text-retro-accent uppercase tracking-wider bg-black/50 px-2 py-1 rounded-full">
                                                            Select "Share tab audio" in the dialog
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Mobile Capture Guidance Pop-over */}
                                                {showMobileGuidance && (
                                                    <>
                                                        <div className="fixed inset-[-1000px] z-[110] bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileGuidance(false)} />
                                                        <div className="absolute bottom-full left-0 right-0 mb-3 bg-zinc-900 border border-retro-accent/30 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-[120] backdrop-blur-2xl pointer-events-auto">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h4 className="text-[12px] font-extrabold uppercase text-retro-accent tracking-widest">Mobile Recording Guide</h4>
                                                                <button onClick={() => setShowMobileGuidance(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
                                                            </div>

                                                            <div className="space-y-4 mb-6">
                                                                <div className="flex gap-3">
                                                                    <div className="w-5 h-5 rounded-full bg-retro-accent/20 flex items-center justify-center text-retro-accent text-[10px] font-bold shrink-0">1</div>
                                                                    <p className="text-[10px] text-zinc-300 leading-relaxed">Your browser or device does not support automated tab audio capture. Please use **Manual Mode** instead.</p>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <div className="w-5 h-5 rounded-full bg-retro-accent/20 flex items-center justify-center text-retro-accent text-[10px] font-bold shrink-0">2</div>
                                                                    <p className="text-[10px] text-zinc-300 leading-relaxed">Switch to manual mode below, then press **Initialize Capture**.</p>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <div className="w-5 h-5 rounded-full bg-retro-accent/20 flex items-center justify-center text-retro-accent text-[10px] font-bold shrink-0">3</div>
                                                                    <p className="text-[10px] text-zinc-300 leading-relaxed">Press **Play** on the video to start the recording.</p>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => {
                                                                    setIsManualMode(true);
                                                                    setShowMobileGuidance(false);
                                                                }}
                                                                className="w-full py-3 bg-retro-accent text-white rounded-xl font-extrabold text-[11px] uppercase shadow-lg shadow-retro-accent/20 active:scale-95 transition-all"
                                                            >
                                                                Switch to Manual Capture Mode
                                                            </button>
                                                            <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-r border-b border-retro-accent/30 rotate-45" />
                                                        </div>
                                                    </>
                                                )}

                                                {!isExtracting && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowPadSelector(!showPadSelector);
                                                        }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-black/20 hover:bg-black/40 flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/5"
                                                        title="Change Target Pad"
                                                    >
                                                        <LayoutGrid size={14} />
                                                    </button>
                                                )}

                                                {/* Pad Selector Pop-over */}
                                                {showPadSelector && (
                                                    <>
                                                        {/* Backdrop to capture clicks and ensure pop-over priority */}
                                                        <div
                                                            className="fixed inset-[-1000px] z-[90] bg-black/10 backdrop-blur-[1px]"
                                                            onClick={() => setShowPadSelector(false)}
                                                        />

                                                        <div className="absolute bottom-full left-0 right-0 mb-3 bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-200 z-[100] backdrop-blur-2xl pointer-events-auto">
                                                            <div className="flex items-center justify-between mb-3 px-1">
                                                                <span className="text-[9px] font-extrabold uppercase text-zinc-500 tracking-[0.2em]">Select Target Pad</span>
                                                                <button onClick={() => setShowPadSelector(false)} className="text-zinc-600 hover:text-white"><X size={12} /></button>
                                                            </div>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {Array.from({ length: 16 }).map((_, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedPadIndex(i);
                                                                            setShowPadSelector(false);
                                                                        }}
                                                                        className={`aspect-square rounded-lg text-[10px] font-extrabold transition-all border ${selectedPadIndex === i
                                                                            ? 'bg-retro-accent text-white border-retro-accent shadow-[0_0_10px_rgba(234,76,137,0.3)]'
                                                                            : 'bg-zinc-800 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'
                                                                            }`}
                                                                    >
                                                                        {i + 1}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-4 h-4 bg-zinc-900 border-r border-b border-white/10 rotate-45" />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
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
        </div >
    );
};
