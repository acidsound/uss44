import React, { useEffect, useRef } from 'react';
import { VolumeX, Volume2, Music, Trash2, X } from 'lucide-react';
import { usePadStore } from '../stores/padStore';

interface PadMenuProps {
    padIndex: number;
    isOpen: boolean;
    onClose: () => void;
    anchorRect?: DOMRect;
}

export const PadMenu: React.FC<PadMenuProps> = ({ padIndex, isOpen, onClose, anchorRect }) => {
    const { pads, currentChannel, toggleMute, toggleSolo, clearPad } = usePadStore();
    const pad = pads[`${currentChannel}-${padIndex}`];
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen || !pad) return null;

    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        top: anchorRect ? anchorRect.bottom + 8 : '50%',
        left: anchorRect ? anchorRect.left : '50%',
        transform: anchorRect ? 'none' : 'translate(-50%, -50%)',
        zIndex: 1000,
    };

    return (
        <div
            ref={menuRef}
            style={menuStyle}
            className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-1 min-w-[160px] animate-in fade-in zoom-in duration-200"
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 mb-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pad {padIndex + 1} Options</span>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>

            <button
                onClick={() => { toggleSolo(padIndex); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${pad.solo ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
            >
                <Music size={16} className={pad.solo ? 'animate-pulse' : ''} />
                <span>{pad.solo ? 'Unsolo Pad' : 'Solo Pad'}</span>
            </button>

            <button
                onClick={() => { toggleMute(padIndex); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all rounded ${pad.mute ? 'bg-retro-accent/20 text-retro-accent' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
            >
                {pad.mute ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{pad.mute ? 'Unmute Pad' : 'Mute Pad'}</span>
            </button>

            <div className="h-px bg-zinc-800 my-1 mx-2" />

            <button
                onClick={() => { if (confirm(`Clear Pad ${padIndex + 1}?`)) { clearPad(padIndex); onClose(); } }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-400/10 transition-all rounded"
            >
                <Trash2 size={16} />
                <span>Clear Pad</span>
            </button>
        </div>
    );
};
