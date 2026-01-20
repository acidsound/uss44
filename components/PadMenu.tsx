import React, { useEffect, useRef } from 'react';
import { VolumeX, Volume2, Music, Trash2, X, Copy } from 'lucide-react';
import { usePadStore } from '../stores/padStore';

interface PadMenuProps {
    padIndex: number;
    isOpen: boolean;
    onClose: () => void;
}

export const PadMenu: React.FC<PadMenuProps> = ({ padIndex, isOpen, onClose }) => {
    const { pads, currentChannel, toggleMute, toggleSolo, clearPad, setCloneMode } = usePadStore();
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

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                ref={menuRef}
                className="w-full max-w-xs bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-800/50">
                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">Pad {padIndex + 1} Options</span>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-2 space-y-1">
                    <button
                        onClick={() => { toggleSolo(padIndex); onClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase transition-all rounded-xl ${pad.solo ? 'bg-amber-500/20 text-amber-500' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Music size={18} className={pad.solo ? 'animate-pulse' : ''} />
                        <span>{pad.solo ? 'Unsolo Pad' : 'Solo Pad'}</span>
                    </button>

                    <button
                        onClick={() => { toggleMute(padIndex); onClose(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase transition-all rounded-xl ${pad.mute ? 'bg-retro-accent/20 text-retro-accent' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}
                    >
                        {pad.mute ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        <span>{pad.mute ? 'Unmute Pad' : 'Mute Pad'}</span>
                    </button>

                    <button
                        onClick={() => { setCloneMode(`${currentChannel}-${padIndex}`); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-zinc-300 hover:bg-white/5 hover:text-white transition-all rounded-xl"
                    >
                        <Copy size={18} />
                        <span>Clone Pad</span>
                    </button>

                    <div className="h-px bg-white/5 my-1 mx-2" />

                    <button
                        onClick={() => { if (confirm(`Clear Pad ${padIndex + 1}?`)) { clearPad(padIndex); onClose(); } }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-red-500 hover:bg-red-500/10 transition-all rounded-xl"
                    >
                        <Trash2 size={18} />
                        <span>Clear Pad</span>
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-4 bg-zinc-800/80 text-zinc-400 font-extrabold uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
