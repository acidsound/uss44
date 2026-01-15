
import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Download, Upload, Check, Loader2, Library } from 'lucide-react';
import { usePadStore } from '../stores/padStore';

interface SamplePackManagerProps {
    onClose: () => void;
}

export const SamplePackManager: React.FC<SamplePackManagerProps> = ({ onClose }) => {
    const { samplePacks, addSamplePack, deleteSamplePack, updateSamplePack, currentSamplePackId, loadSamplePack } = usePadStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');

    const [editName, setEditName] = useState('');
    const [editUrl, setEditUrl] = useState('');

    const handleAdd = async () => {
        if (!newName || !newUrl) return;
        await addSamplePack(newName, newUrl);
        setNewName('');
        setNewUrl('');
        setIsAdding(false);
    };

    const handleUpdate = async (id: string) => {
        if (!editName || !editUrl) return;
        await updateSamplePack(id, { name: editName, url: editUrl });
        setEditingId(null);
    };

    const handleExport = () => {
        const data = JSON.stringify(samplePacks, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uss44-sample-packs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const packs = JSON.parse(event.target?.result as string);
                if (Array.isArray(packs)) {
                    for (const pack of packs) {
                        // Check if already exists by URL or ID (avoid duplicates)
                        if (!samplePacks.find(p => p.url === pack.url)) {
                            await addSamplePack(pack.name, pack.url);
                        }
                    }
                }
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">

                <div className="p-6 border-b border-white/5 flex justify-between items-start bg-zinc-800/50">
                    <div className="flex gap-4 items-start">
                        <div className="p-3 bg-retro-accent/10 rounded-xl text-retro-accent border border-retro-accent/20">
                            <Library size={24} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold uppercase text-white tracking-widest">Sample Packs</h2>
                            <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-tight">Manage your JSON library sources</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {samplePacks.map((pack) => (
                        <div key={pack.id} className="bg-zinc-800/30 border border-white/5 rounded-xl p-4 group">
                            {editingId === pack.id ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="Pack Name"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-retro-accent outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={editUrl}
                                        onChange={e => setEditUrl(e.target.value)}
                                        placeholder="JSON URL"
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-retro-accent outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleUpdate(pack.id)} className="flex-1 bg-retro-accent text-white py-2 rounded-lg text-[10px] font-extrabold uppercase">Save</button>
                                        <button onClick={() => setEditingId(null)} className="flex-1 bg-zinc-700 text-white py-2 rounded-lg text-[10px] font-extrabold uppercase">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold uppercase text-zinc-200 truncate">{pack.name}</span>
                                            {pack.isDefault && <span className="text-[8px] bg-white/10 text-zinc-500 px-1.5 py-0.5 rounded font-bold">DEFAULT</span>}
                                        </div>
                                        <div className="text-[9px] text-zinc-600 truncate mt-1 font-mono">{pack.url}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {currentSamplePackId === pack.id ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-retro-accent/20 border border-retro-accent/30 rounded-lg text-retro-accent text-[9px] font-extrabold uppercase">
                                                <Check size={12} />
                                                Active
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => loadSamplePack(pack.id)}
                                                className="px-3 py-1.5 bg-zinc-700 hover:bg-white hover:text-black transition-all rounded-lg text-[9px] font-extrabold uppercase text-white shadow-lg active:scale-95"
                                            >
                                                Switch
                                            </button>
                                        )}
                                        <div className="w-px h-4 bg-white/10 mx-1" />
                                        <button
                                            onClick={() => {
                                                setEditingId(pack.id);
                                                setEditName(pack.name);
                                                setEditUrl(pack.url);
                                            }}
                                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        {!pack.isDefault && (
                                            <button onClick={() => deleteSamplePack(pack.id)} className="p-2 text-red-500/50 hover:text-red-500 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {isAdding ? (
                        <div className="bg-retro-accent/5 border border-retro-accent/20 rounded-xl p-4 space-y-3">
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Pack Name (e.g. Future Bass Essentials)"
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-retro-accent outline-none"
                            />
                            <input
                                type="text"
                                value={newUrl}
                                onChange={e => setNewUrl(e.target.value)}
                                placeholder="JSON URL (https://...)"
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-retro-accent outline-none"
                            />
                            <div className="flex gap-2">
                                <button onClick={handleAdd} className="flex-1 bg-retro-accent text-white py-2 rounded-lg text-[10px] font-extrabold uppercase">Add Pack</button>
                                <button onClick={() => setIsAdding(false)} className="flex-1 bg-zinc-700 text-white py-2 rounded-lg text-[10px] font-extrabold uppercase">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-4 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-600 hover:border-retro-accent/40 hover:text-white hover:bg-white/5 transition-all text-[10px] font-extrabold uppercase tracking-widest"
                        >
                            <Plus size={20} />
                            Add New Pack
                        </button>
                    )}
                </div>

                <div className="p-4 bg-zinc-950 border-t border-white/5 flex gap-2">
                    <button
                        onClick={handleExport}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-extrabold uppercase text-zinc-300 transition-all"
                    >
                        <Download size={14} />
                        Export List
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-extrabold uppercase text-zinc-300 transition-all cursor-pointer">
                        <Upload size={14} />
                        Import List
                        <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                    </label>
                </div>
            </div>
        </div>
    );
};
