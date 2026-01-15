/**
 * Dig Network Component
 * Real-time social media digging interface with time range selection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Play, Square, Loader2, AlertCircle,
    Youtube, Music2, Globe, Zap, Radio, ExternalLink,
    Disc3, Scissors, Clock
} from 'lucide-react';
import { parseUrl, getPlatformColor, getPlatformName, SocialPlatform, ParsedUrl } from '../utils/urlParser';
import { createDigPreview, DigPreviewItem } from '../services/oembedService';
import { extractAudio, ExtractionProgress, checkBackendHealth, searchVideos, SearchResult } from '../services/digService';
import { usePadStore, generateWaveform } from '../stores/padStore';
import { useAudioStore } from '../stores/audioStore';
import { dbService } from '../services/dbService';

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

    // Time range state
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [showTimeRange, setShowTimeRange] = useState(false);

    // Video player state
    const [showPlayer, setShowPlayer] = useState(false);
    const playerRef = useRef<HTMLIFrameElement>(null);
    const ytPlayerRef = useRef<any>(null);

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
            return;
        }

        const parsed = parseUrl(inputUrl);
        setParsedUrl(parsed);
        setShowPlayer(false);

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
                setIsSearching(true);
                const results = await searchVideos(inputUrl.trim());
                setSearchResults(results);
                setIsSearching(false);
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
    }, [inputUrl]);

    // Handle URL paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData('text');
        setInputUrl(pastedText.trim());
    }, []);

    // Rutube current time (updated via postMessage)
    const [rutubeCurrentTime, setRutubeCurrentTime] = useState<number>(0);

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

    // Initialize Rutube postMessage listener
    useEffect(() => {
        if (!showPlayer || !preview?.embedUrl || preview.platform !== 'rutube') return;

        const handleMessage = (event: MessageEvent) => {
            if (!event.origin.includes('rutube.ru')) return;

            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                if (data.type === 'player:currentTime' || data.event === 'timeupdate' || data.data?.currentTime !== undefined) {
                    const time = data.data?.currentTime || data.currentTime || data.time;
                    if (typeof time === 'number') {
                        setRutubeCurrentTime(Math.floor(time));
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }
        };

        window.addEventListener('message', handleMessage);

        // Request time updates from Rutube player periodically
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

    // Get current time from player (YouTube or Rutube)
    const getCurrentPlayerTime = useCallback((): number | null => {
        if (preview?.platform === 'youtube') {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                return Math.floor(ytPlayerRef.current.getCurrentTime());
            }
        } else if (preview?.platform === 'rutube') {
            return rutubeCurrentTime;
        }
        return null;
    }, [preview?.platform, rutubeCurrentTime]);

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
        <div className="space-y-4">
            {/* Backend Status */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Disc3 size={14} className="text-retro-accent animate-spin-slow" />
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">
                        Dig Network
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
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
                            <span className="text-[8px] font-bold text-amber-500 uppercase">Server not running</span>
                        </>
                    )}
                </div>
            </div>

            {/* URL Input */}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {parsedUrl && parsedUrl.platform !== 'unknown' ? (
                        <div
                            className="p-1 rounded"
                            style={{ backgroundColor: `${getPlatformColor(parsedUrl.platform)}20` }}
                        >
                            <PlatformIcon platform={parsedUrl.platform} size={14} />
                        </div>
                    ) : (
                        <Search size={14} className="text-zinc-500" />
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Paste YouTube, TikTok, Instagram, 小红书, Rutube URL..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onPaste={handlePaste}
                    className="w-full bg-black/60 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-[11px] font-bold text-white focus:border-retro-accent/50 focus:outline-none transition-all placeholder:text-zinc-600"
                />
                {parsedUrl?.isValid && parsedUrl.platform !== 'unknown' && (
                    <div
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full"
                        style={{
                            backgroundColor: `${getPlatformColor(parsedUrl.platform)}20`,
                            color: getPlatformColor(parsedUrl.platform)
                        }}
                    >
                        {getPlatformName(parsedUrl.platform)}
                    </div>
                )}
            </div>
            {/* Search Results */}
            {isSearching && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 bg-zinc-900/40 border border-white/5 rounded-xl animate-in fade-in duration-300">
                    <Loader2 size={24} className="text-retro-accent animate-spin" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Searching Videos...</span>
                </div>
            )}

            {searchResults.length > 0 && !preview && !isSearching && (
                <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Search size={12} className="text-zinc-500" />
                            <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Results on {searchResults[0]?.platform === 'youtube' ? 'YouTube' : 'Social Media'}</span>
                        </div>
                        <span className="text-[8px] font-bold text-zinc-600">{searchResults.length} found</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                        {searchResults.map((result) => (
                            <button
                                key={result.id + result.url}
                                onClick={() => setInputUrl(result.url)}
                                className="flex gap-3 bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-retro-accent/30 p-2 rounded-xl transition-all text-left group"
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
                                    {result.uploader && (
                                        <p className="text-[9px] text-zinc-500 font-bold truncate mt-1">
                                            {result.uploader}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <div
                                            className="px-1.5 py-0.5 rounded-full text-[7px] font-extrabold uppercase ring-1 ring-inset"
                                            style={{
                                                backgroundColor: result.platform === 'youtube' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                                                color: result.platform === 'youtube' ? '#ef4444' : '#a855f7',
                                                borderColor: result.platform === 'youtube' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)'
                                            }}
                                        >
                                            {result.platform}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {/* Preview Card */}
            {preview && (
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Video Preview / Player */}
                    {showPlayer && preview.embedUrl ? (
                        <div>
                            {/* Video iframe - no overlay */}
                            <div className="aspect-video bg-black">
                                <iframe
                                    ref={playerRef}
                                    id="yt-player"
                                    src={`${preview.embedUrl}?enablejsapi=1&origin=${window.location.origin}`}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                            {/* Player controls - below video */}
                            <div className="bg-zinc-800/80 px-3 py-2 flex items-center justify-between gap-2">
                                {/* Set Start/End buttons - YouTube and Rutube */}
                                {(preview.platform === 'youtube' || preview.platform === 'rutube') && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={setStartFromPlayer}
                                            className="bg-emerald-500/80 hover:bg-emerald-500 px-3 py-1.5 text-[9px] font-extrabold text-white rounded-lg transition-all flex items-center gap-1"
                                        >
                                            ▶ Set Start {preview.platform === 'rutube' && rutubeCurrentTime > 0 && `(${formatTime(rutubeCurrentTime)})`}
                                        </button>
                                        <button
                                            onClick={setEndFromPlayer}
                                            className="bg-amber-500/80 hover:bg-amber-500 px-3 py-1.5 text-[9px] font-extrabold text-white rounded-lg transition-all flex items-center gap-1"
                                        >
                                            ■ Set End
                                        </button>
                                    </div>
                                )}
                                {/* Current time display for Rutube */}
                                {preview.platform === 'rutube' && rutubeCurrentTime > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-zinc-400">
                                        {formatTime(rutubeCurrentTime)}
                                    </span>
                                )}
                                <button
                                    onClick={() => setShowPlayer(false)}
                                    className="bg-zinc-700/80 hover:bg-zinc-600 px-3 py-1.5 text-[9px] font-bold text-white rounded-lg transition-all ml-auto"
                                >
                                    Hide Player
                                </button>
                            </div>
                        </div>
                    ) : preview.thumbnail ? (
                        <div
                            className="relative aspect-video bg-black cursor-pointer group"
                            onClick={() => preview.embedUrl && setShowPlayer(true)}
                        >
                            <img
                                src={preview.thumbnail}
                                alt={preview.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />

                            {/* Play button overlay */}
                            {preview.embedUrl && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-16 h-16 bg-retro-accent/90 rounded-full flex items-center justify-center shadow-2xl shadow-retro-accent/50">
                                        <Play size={28} className="text-white ml-1" fill="white" />
                                    </div>
                                </div>
                            )}

                            <div
                                className="absolute top-2 left-2 text-[8px] font-extrabold uppercase px-2 py-1 rounded-full flex items-center gap-1"
                                style={{
                                    backgroundColor: `${getPlatformColor(preview.platform)}`,
                                    color: 'white'
                                }}
                            >
                                <PlatformIcon platform={preview.platform} size={10} />
                                {getPlatformName(preview.platform)}
                            </div>
                            {preview.duration && (
                                <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 text-[9px] font-extrabold rounded border border-white/10 text-white flex items-center gap-1">
                                    <Clock size={10} />
                                    {preview.duration}
                                </div>
                            )}

                            {/* Hint to click */}
                            {preview.embedUrl && (
                                <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[8px] font-bold text-zinc-400 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Click to preview video
                                </div>
                            )}
                        </div>
                    ) : preview.isLoading ? (
                        <div className="aspect-video bg-black flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-retro-accent animate-spin" />
                        </div>
                    ) : (
                        <div className="aspect-video bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                            <PlatformIcon platform={preview.platform} size={48} />
                        </div>
                    )}

                    {/* Info & Controls */}
                    <div className="p-4 space-y-3">
                        <div>
                            <h3 className="font-extrabold text-sm text-white truncate mb-1">
                                {preview.title}
                            </h3>
                            {preview.author && (
                                <p className="text-[10px] text-zinc-500 font-bold truncate">
                                    by {preview.author}
                                </p>
                            )}
                        </div>

                        {/* Time Range Selector */}
                        {showTimeRange && videoDuration > 0 && (
                            <div className="bg-black/40 rounded-xl p-3 space-y-3 border border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Scissors size={12} className="text-retro-accent" />
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">
                                            Select Range
                                        </span>
                                    </div>
                                    <div className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${isValidRange
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {formatTime(selectedDuration)} / {formatTime(MAX_DURATION_SECONDS)} max
                                    </div>
                                </div>

                                {/* Visual Timeline */}
                                <div className="relative h-8 bg-zinc-800 rounded-lg overflow-hidden">
                                    {/* Selected range indicator */}
                                    <div
                                        className="absolute h-full bg-retro-accent/30"
                                        style={{
                                            left: `${(startTime / videoDuration) * 100}%`,
                                            width: `${((endTime - startTime) / videoDuration) * 100}%`
                                        }}
                                    />

                                    {/* Start handle */}
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
                                        value={startTime}
                                        onChange={(e) => handleStartTimeChange(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        style={{ clipPath: 'inset(0 50% 0 0)' }}
                                    />

                                    {/* End handle */}
                                    <input
                                        type="range"
                                        min={0}
                                        max={videoDuration}
                                        value={endTime}
                                        onChange={(e) => handleEndTimeChange(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        style={{ clipPath: 'inset(0 0 0 50%)' }}
                                    />

                                    {/* Start marker */}
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-emerald-500 shadow-lg"
                                        style={{ left: `${(startTime / videoDuration) * 100}%` }}
                                    >
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full" />
                                    </div>

                                    {/* End marker */}
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-amber-500 shadow-lg"
                                        style={{ left: `${(endTime / videoDuration) * 100}%` }}
                                    >
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-amber-500 rounded-full" />
                                    </div>
                                </div>

                                {/* Time inputs */}
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex-1 flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-1.5 border border-white/5">
                                        <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Start</span>
                                        <input
                                            type="text"
                                            value={formatTime(startTime)}
                                            onChange={(e) => handleStartTimeChange(parseTime(e.target.value))}
                                            className="w-16 bg-transparent text-[11px] font-mono font-bold text-white text-right outline-none"
                                        />
                                    </div>
                                    <div className="flex-none text-zinc-600 font-bold">→</div>
                                    <div className="flex-1 flex items-center justify-between bg-zinc-900/60 rounded-lg px-3 py-1.5 border border-white/5">
                                        <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">End</span>
                                        <input
                                            type="text"
                                            value={formatTime(endTime)}
                                            onChange={(e) => handleEndTimeChange(parseTime(e.target.value))}
                                            className="w-16 bg-transparent text-[11px] font-mono font-bold text-white text-right outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Warning if over limit */}
                                {!isValidRange && (
                                    <div className="flex items-center gap-2 text-[9px] text-red-400">
                                        <AlertCircle size={12} />
                                        Maximum {MAX_DURATION_SECONDS / 60} minutes allowed
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Extraction Progress */}
                        {isExtracting && extractionProgress && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[9px]">
                                    <span className="text-zinc-400 font-bold uppercase">
                                        {extractionProgress.message}
                                    </span>
                                    <span className="text-retro-accent font-extrabold">
                                        {extractionProgress.progress}%
                                    </span>
                                </div>
                                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-retro-accent transition-all duration-300"
                                        style={{ width: `${extractionProgress.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                                <AlertCircle size={14} />
                                <span className="text-[10px] font-bold">{error}</span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleDig}
                                disabled={isExtracting || !backendAvailable || (showTimeRange && !isValidRange)}
                                className={`flex-1 py-3 rounded-xl font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${isExtracting || !backendAvailable || (showTimeRange && !isValidRange)
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                    : 'bg-retro-accent text-white hover:bg-retro-accent/80 active:scale-95 shadow-lg shadow-retro-accent/20'
                                    }`}
                            >
                                {isExtracting ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Extracting...
                                    </>
                                ) : (
                                    <>
                                        <Zap size={14} />
                                        Dig {showTimeRange && `(${formatTime(selectedDuration)})`} to Pad {targetPadIndex + 1}
                                    </>
                                )}
                            </button>
                            <a
                                href={preview.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
                            >
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            )}



            {/* Recent Digs */}
            {recentDigs.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-600 px-1">
                        Recent Digs
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        {recentDigs.map((dig) => (
                            <div
                                key={dig.id}
                                onClick={() => setInputUrl(dig.url)}
                                className="bg-zinc-900/50 border border-white/5 rounded-lg p-2 cursor-pointer hover:border-retro-accent/30 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    {dig.thumbnail ? (
                                        <img src={dig.thumbnail} className="w-10 h-10 rounded object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                                            <PlatformIcon platform={dig.platform} size={14} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-extrabold text-white truncate">
                                            {dig.title}
                                        </p>
                                        <p className="text-[8px] text-zinc-500 uppercase">
                                            {getPlatformName(dig.platform)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Platform Hints */}
            {!preview && !inputUrl && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                    {(['youtube', 'tiktok', 'instagram', 'rutube'] as SocialPlatform[]).map((platform) => (
                        <div
                            key={platform}
                            className="bg-zinc-900/30 border border-white/5 rounded-xl p-3 flex items-center gap-3 opacity-50"
                        >
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `${getPlatformColor(platform)}15` }}
                            >
                                <PlatformIcon platform={platform} size={16} />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400">
                                {getPlatformName(platform)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
