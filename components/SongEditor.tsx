import React, { useState, useRef, useCallback } from 'react';
import { Music, Grid, GripVertical } from 'lucide-react';
import { useSequencerStore } from '../stores/sequencerStore';

export const SongEditor: React.FC = () => {
    const {
        song,
        songIndex,
        selectedSongIndex,
        setSelectedSongIndex,
        insertIntoSong,
        removeFromSong,
        setSong,
        patternLibrary,
        createPattern
    } = useSequencerStore();

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<{ index: number, side: 'left' | 'right' } | null>(null);
    const [lastTap, setLastTap] = useState<{ index: number, time: number } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const patternLetters = Array.from({ length: 16 }, (_, i) => String.fromCharCode(65 + i));

    const handleTileTap = (index: number) => {
        const now = Date.now();
        if (lastTap && lastTap.index === index && now - lastTap.time < 300) {
            removeFromSong(index);
            setLastTap(null);
        } else {
            setSelectedSongIndex(index);
            setLastTap({ index, time: now });
        }
    };

    const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
        const target = e.target as HTMLElement;
        if (target.closest('.drag-handle')) {
            e.preventDefault();
            setDraggedIndex(index);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (draggedIndex === null) return;

        const x = e.clientX;
        const y = e.clientY;

        // Find which item we're over and which side (left/right)
        for (let i = 0; i < itemRefs.current.length; i++) {
            const item = itemRefs.current[i];
            if (item) {
                const rect = item.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    // Determine left or right side based on X position
                    const midX = rect.left + rect.width / 2;
                    const side = x < midX ? 'left' : 'right';
                    setDropPosition({ index: i, side });
                    return;
                }
            }
        }

        setDropPosition(null);
    }, [draggedIndex]);

    const handlePointerUp = useCallback(() => {
        if (draggedIndex !== null && dropPosition !== null) {
            // Calculate the actual target index based on side
            let targetIndex = dropPosition.index;

            // If dropping to the right side, insert after that item
            if (dropPosition.side === 'right') {
                targetIndex = dropPosition.index + 1;
            }

            // Adjust for the removal of the dragged item
            if (draggedIndex < targetIndex) {
                targetIndex -= 1;
            }

            if (draggedIndex !== targetIndex) {
                const newSong = [...song];
                const [draggedItem] = newSong.splice(draggedIndex, 1);
                newSong.splice(targetIndex, 0, draggedItem);
                setSong(newSong);
                setSelectedSongIndex(targetIndex);
            }
        }
        setDraggedIndex(null);
        setDropPosition(null);
    }, [draggedIndex, dropPosition, song, setSong, setSelectedSongIndex]);

    return (
        <div className="w-full h-full bg-zinc-900 flex flex-col overflow-hidden select-none">

            {/* Pattern Selector (Top) */}
            <div className="flex-none p-2 bg-zinc-950 border-b border-zinc-800 z-10">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <Grid size={10} /> Pattern Selector
                </div>
                <div className="grid grid-cols-8 gap-1">
                    {patternLetters.map((letter, i) => (
                        <button
                            key={letter}
                            onClick={() => {
                                const id = `ptn-${i}`;
                                createPattern(id);
                                insertIntoSong(id, selectedSongIndex);
                            }}
                            className="h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-retro-accent active:text-white text-zinc-400 font-extrabold text-[12px] rounded transition-colors flex items-center justify-center uppercase"
                        >
                            {letter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Song Sequence Grid (Tiles) */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-2"
                style={{ scrollbarGutter: 'stable' }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <Music size={10} /> Song Sequence
                </div>

                {song.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-700 gap-2 opacity-30 border-2 border-dashed border-zinc-800 rounded-xl">
                        <Grid size={32} />
                        <p className="text-[10px] font-extrabold uppercase">Add patterns to build a song</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {song.map((item, index) => {
                            const isPlaying = index === songIndex;
                            const isSelected = index === selectedSongIndex;
                            const isDragging = index === draggedIndex;
                            const patternIndex = parseInt(item.patternId.split('-')[1]);
                            const patternLetter = String.fromCharCode(65 + patternIndex);

                            // Drop indicator visibility
                            const showLeftIndicator = dropPosition?.index === index && dropPosition?.side === 'left' && draggedIndex !== null && draggedIndex !== index;
                            const showRightIndicator = dropPosition?.index === index && dropPosition?.side === 'right' && draggedIndex !== null && draggedIndex !== index;

                            return (
                                <div key={item.id} className="relative">
                                    {/* LEFT Drop Indicator */}
                                    {showLeftIndicator && (
                                        <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-retro-accent rounded-full shadow-[0_0_12px_rgba(255,30,86,0.8)] z-20" />
                                    )}

                                    {/* RIGHT Drop Indicator */}
                                    {showRightIndicator && (
                                        <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-retro-accent rounded-full shadow-[0_0_12px_rgba(255,30,86,0.8)] z-20" />
                                    )}

                                    <div
                                        ref={el => itemRefs.current[index] = el}
                                        onClick={() => !isDragging && handleTileTap(index)}
                                        className={`
                                            relative aspect-square flex flex-col items-center justify-center rounded-lg border-2 transition-all cursor-pointer overflow-hidden
                                            ${isPlaying ? 'border-retro-accent shadow-[0_0_15px_rgba(255,30,86,0.4)] z-10' : (isSelected ? 'border-white bg-zinc-800' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700')}
                                            ${isDragging ? 'opacity-30 scale-90 border-dashed border-zinc-600' : 'opacity-100'}
                                        `}
                                    >
                                        {/* Drag Handle */}
                                        <div
                                            className="drag-handle absolute top-0 right-0 p-1.5 text-zinc-600 hover:text-zinc-400 active:text-retro-accent cursor-grab active:cursor-grabbing touch-none"
                                            onPointerDown={(e) => handlePointerDown(e, index)}
                                        >
                                            <GripVertical size={12} />
                                        </div>

                                        {/* Playhead Indicator */}
                                        {isPlaying && (
                                            <div className="absolute top-0 left-0 w-full h-1 bg-retro-accent animate-pulse" />
                                        )}

                                        {/* Index Number */}
                                        <div className="absolute top-1 left-1.5 text-[8px] font-mono text-zinc-600 font-bold">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </div>

                                        {/* Pattern Letter */}
                                        <div className={`text-xl font-extrabold uppercase tracking-tighter ${isPlaying ? 'text-retro-accent' : (isSelected ? 'text-white' : 'text-zinc-500')}`}>
                                            {patternLetter}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty "Add" Helper */}
                        {song.length > 0 && selectedSongIndex === -1 && (
                            <div className="aspect-square rounded-lg border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-800 opacity-50">
                                <Grid size={16} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Hint */}
            <div className="p-2 border-t border-zinc-800 bg-zinc-950 text-center">
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                    Tap to select • Double tap to delete • Drag handle to reorder
                </p>
            </div>
        </div>
    );
};
