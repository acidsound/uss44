
import React, { useRef, useState } from 'react';
import { 
  Trash2, Download, Upload, Music, Disc, FileJson, 
  Save, FolderOpen, RefreshCw, X, AlertTriangle, Loader2 
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
    
    if (!confirm("Importing will overwrite current project. Continue?")) {
        e.target.value = '';
        return;
    }

    handleAction(async () => {
      await projectService.importAll(file);
    }, 'Project Imported');
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
    
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-end p-4 animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
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
                if(confirm("Factory Reset: Clear all pads and sequences?")) {
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

          {/* Sound Operations */}
          <button disabled={loading} onClick={() => openExplorer('LOAD', 'SOUND')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <FolderOpen size={14} /> <span className="text-[10px] font-extrabold uppercase">Load Sound</span>
          </button>
          <button disabled={loading} onClick={() => openExplorer('SAVE', 'SOUND')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <Save size={14} /> <span className="text-[10px] font-extrabold uppercase">Save Sound</span>
          </button>

          <div className="h-px bg-white/5 my-1" />

          {/* Sequence Operations */}
          <button disabled={loading} onClick={() => openExplorer('LOAD', 'SEQUENCE')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <FolderOpen size={14} /> <span className="text-[10px] font-extrabold uppercase">Load Sequence</span>
          </button>
          <button disabled={loading} onClick={() => openExplorer('SAVE', 'SEQUENCE')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <Save size={14} /> <span className="text-[10px] font-extrabold uppercase">Save Sequence</span>
          </button>

          <div className="h-px bg-white/5 my-1" />

          {/* Song Operations */}
          <button disabled={loading} onClick={() => openExplorer('LOAD', 'SONG')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <Music size={14} /> <span className="text-[10px] font-extrabold uppercase">Load Song</span>
          </button>
          <button disabled={loading} onClick={() => openExplorer('SAVE', 'SONG')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-zinc-300 rounded-lg transition-colors">
            <Disc size={14} /> <span className="text-[10px] font-extrabold uppercase">Save Song</span>
          </button>

          <div className="h-px bg-white/5 my-1" />

          {/* File Operations */}
          <button disabled={loading} onClick={() => handleAction(() => projectService.exportAll(), 'Export Complete')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-retro-accent/20 text-zinc-300 hover:text-white rounded-lg transition-colors">
            <Download size={14} /> <span className="text-[10px] font-extrabold uppercase">Export All (JSON)</span>
          </button>
          
          <button disabled={loading} onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-retro-accent/20 text-zinc-300 hover:text-white rounded-lg transition-colors">
            <Upload size={14} /> <span className="text-[10px] font-extrabold uppercase">Import All</span>
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
