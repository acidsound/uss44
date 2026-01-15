
import React, { useRef, useState } from 'react';
import {
  Trash2, Download, Upload, Music, Disc, FileJson,
  Save, FolderOpen, RefreshCw, X, AlertTriangle, Loader2,
  List, Speaker
} from 'lucide-react';
import { projectService, LibraryType } from '../services/projectService';
import { FileExplorer } from './FileExplorer';

interface SettingsMenuProps {
  onClose: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [explorerConfig, setExplorerConfig] = useState<{ mode: 'SAVE' | 'LOAD', type: LibraryType } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAction = async (action: () => Promise<void>, successMsg: string) => {
    setLoading(true);
    setStatus('Processing...');
    try {
      await action();
      setStatus(successMsg);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
      setStatus('Error!');
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleAction(async () => {
      await projectService.importAndLoadFile(file);
    }, 'Import Successful');
  };

  const openExplorer = (mode: 'SAVE' | 'LOAD', type: LibraryType) => {
    setExplorerConfig({ mode, type });
  };

  return (
    <>
      {explorerConfig && (
        <FileExplorer
          mode={explorerConfig.mode}
          type={explorerConfig.type}
          onClose={() => setExplorerConfig(null)}
          onSuccess={() => {
            setExplorerConfig(null);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-end p-4 animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-64 bg-[#1e1e22] border border-white/10 rounded-xl shadow-2xl overflow-hidden mt-12 mr-2 animate-in slide-in-from-top-4 duration-200">

          <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
            <span className="text-xs font-extrabold uppercase text-zinc-400 tracking-widest">System</span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>

          <div className="p-2 space-y-1">

            {/* Init */}
            <button
              disabled={loading}
              onClick={() => {
                if (confirm("Factory Reset: Clear all pads and sequences?")) {
                  handleAction(() => projectService.initAll(), 'System Initialized');
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-red-500/20 text-zinc-300 hover:text-red-400 rounded-lg transition-colors group"
            >
              <Trash2 size={14} className="group-hover:text-red-400" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase">Init All</span>
                <span className="text-[8px] text-zinc-600 group-hover:text-red-400/70">Factory Reset</span>
              </div>
            </button>

            <div className="h-px bg-white/5 my-1" />

            {/* Sequence Operations */}
            <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg group">
              <div className="flex items-center gap-2">
                <List size={14} className="text-zinc-500 group-hover:text-retro-accent" />
                <span className="text-[10px] font-extrabold uppercase text-zinc-400">Sequence</span>
              </div>
              <div className="flex gap-1">
                <button disabled={loading} onClick={() => openExplorer('LOAD', 'SEQUENCE')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Open from Library">
                  <FolderOpen size={14} />
                </button>
                <button disabled={loading} onClick={() => openExplorer('SAVE', 'SEQUENCE')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Save to Library">
                  <Save size={14} />
                </button>
                <button disabled={loading} onClick={() => handleAction(() => projectService.exportCurrentItem('SEQUENCE'), 'Sequence Exported')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Export as JSON">
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 my-1" />

            {/* Sound Operations */}
            <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg group">
              <div className="flex items-center gap-2">
                <Speaker size={14} className="text-zinc-500 group-hover:text-retro-accent" />
                <span className="text-[10px] font-extrabold uppercase text-zinc-400">Sound Kit</span>
              </div>
              <div className="flex gap-1">
                <button disabled={loading} onClick={() => openExplorer('LOAD', 'SOUND')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Open from Library">
                  <FolderOpen size={14} />
                </button>
                <button disabled={loading} onClick={() => openExplorer('SAVE', 'SOUND')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Save to Library">
                  <Save size={14} />
                </button>
                <button disabled={loading} onClick={() => handleAction(() => projectService.exportCurrentItem('SOUND'), 'Sound Exported')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Export as JSON">
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 my-1" />

            {/* Song Operations */}
            <div className="flex items-center justify-between px-3 py-2 hover:bg-white/5 rounded-lg group">
              <div className="flex items-center gap-2">
                <Disc size={14} className="text-zinc-500 group-hover:text-retro-accent" />
                <span className="text-[10px] font-extrabold uppercase text-zinc-400">Project Song</span>
              </div>
              <div className="flex gap-1">
                <button disabled={loading} onClick={() => openExplorer('LOAD', 'SONG')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Open from Library">
                  <FolderOpen size={14} />
                </button>
                <button disabled={loading} onClick={() => openExplorer('SAVE', 'SONG')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Save to Library">
                  <Save size={14} />
                </button>
                <button disabled={loading} onClick={() => handleAction(() => projectService.exportCurrentItem('SONG'), 'Song Exported')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors" title="Export as JSON">
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="h-px bg-white/5 my-1" />

            {/* Global Import */}
            <button disabled={loading} onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors group">
              <Upload size={14} className="group-hover:text-retro-accent" />
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase">Import from JSON</span>
                <span className="text-[7px] text-zinc-600 uppercase">Load any Sound, Sequence, or Song file</span>
              </div>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

          </div>

          {/* Status Bar */}
          {status && (
            <div className={`px-4 py-2 text-[9px] font-extrabold uppercase text-center flex items-center justify-center gap-2 ${status.includes('Error') ? 'bg-red-500/20 text-red-400' : 'bg-retro-accent/20 text-retro-accent'}`}>
              {loading && <Loader2 size={10} className="animate-spin" />}
              {status}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
