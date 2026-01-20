import React from 'react';
import { X } from 'lucide-react';
import { ChannelId } from '../types';

interface ChannelModalProps {
    currentChannel: ChannelId;
    onSelect: (id: ChannelId) => void;
    onClose: () => void;
}

export const ChannelModal: React.FC<ChannelModalProps> = ({ currentChannel, onSelect, onClose }) => {
    const channels: ChannelId[] = ['A', 'B', 'C', 'D'];

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-[280px] bg-[#1a1a1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Select Channel</span>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                    {channels.map(ch => (
                        <button
                            key={ch}
                            onClick={() => { onSelect(ch); onClose(); }}
                            className={`h-16 flex flex-col items-center justify-center rounded-2xl border transition-all ${currentChannel === ch
                                    ? 'bg-retro-accent border-retro-accent text-white shadow-[0_0_15px_rgba(255,30,86,0.3)]'
                                    : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            <span className="text-[8px] font-extrabold uppercase opacity-50 mb-1">Channel</span>
                            <span className="text-xl font-black">{ch}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
