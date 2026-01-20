import React from 'react';
import { X } from 'lucide-react';

interface PatternModalProps {
    activePatternId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
}

export const PatternModal: React.FC<PatternModalProps> = ({ activePatternId, onSelect, onClose }) => {
    const patterns = Array.from({ length: 16 }, (_, i) => ({
        id: `ptn-${i}`,
        label: String.fromCharCode(65 + i)
    }));

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-[320px] bg-[#1a1a1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-widest">Select Pattern</span>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 grid grid-cols-4 gap-2">
                    {patterns.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { onSelect(p.id); onClose(); }}
                            className={`h-12 flex items-center justify-center rounded-xl border text-sm font-black transition-all ${activePatternId === p.id
                                    ? 'bg-retro-accent border-retro-accent text-white shadow-[0_0_15px_rgba(255,30,86,0.3)]'
                                    : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
