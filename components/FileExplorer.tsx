
import React, { useEffect, useState, useRef } from 'react';
import { Folder, File, Trash2, Edit2, Save, Download, X, Search, Check, Loader2 } from 'lucide-react';
import { projectService, LibraryType } from '../services/projectService';

interface FileExplorerProps {
  mode: 'SAVE' | 'LOAD';
  type: LibraryType;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FileItem {
  name: string;
  date: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ mode, type, onClose, onSuccess }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshList();
  }, [type]);

  const refreshList = async () => {
    setLoading(true);
    try {
      const list = await projectService.listLibrary(type);
      setFiles(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (mode === 'SAVE') {
      if (!filename.trim()) return;
      setLoading(true);
      try {
        await projectService.saveLibraryItem(type, filename.trim());
        if (onSuccess) onSuccess();
        else onClose();
      } catch (e) {
        alert("Failed to save: " + e);
      } finally {
        setLoading(false);
      }
    } else {
      if (!selectedFile) return;
      setLoading(true);
      try {
        await projectService.loadLibraryItem(type, selectedFile);
        if (onSuccess) onSuccess();
        else onClose();
      } catch (e) {
        alert("Failed to load: " + e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${name}"? This cannot be undone.`)) {
      setLoading(true);
      await projectService.deleteLibraryItem(type, name);
      await refreshList();
      if (selectedFile === name) setSelectedFile(null);
      setLoading(false);
    }
  };

  const startRename = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFile(name);
    setRenameInput(name);
  };

  const submitRename = async () => {
    if (!renamingFile || !renameInput.trim()) {
      setRenamingFile(null);
      return;
    }
    setLoading(true);
    try {
      await projectService.renameLibraryItem(type, renamingFile, renameInput.trim());
      setRenamingFile(null);
      await refreshList();
    } catch (e) {
      alert("Rename failed: " + e);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-2xl bg-[#1e1e22] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] max-h-[90dvh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center flex-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-lg text-retro-accent">
              {type === 'SONG' ? <Download size={20} /> : type === 'SOUND' ? <Folder size={20} /> : <File size={20} />}
            </div>
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-white">
                {mode === 'SAVE' ? 'Save to Library' : 'Load from Library'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{type}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-zinc-900/30 border-b border-white/5 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-xs text-white focus:border-retro-accent focus:outline-none"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px] bg-black/20">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-retro-accent">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-xs font-bold uppercase tracking-widest">Accessing DB...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
              <Folder size={48} className="mb-2 opacity-20" />
              <span className="text-xs font-bold uppercase tracking-widest">No files found</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {filteredFiles.map(file => (
                <div
                  key={file.name}
                  onClick={() => { setSelectedFile(file.name); if (mode === 'SAVE') setFilename(file.name); }}
                  className={`group flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${selectedFile === file.name
                      ? 'bg-retro-accent/10 border-retro-accent text-white'
                      : 'bg-zinc-900/40 border-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File size={16} className={selectedFile === file.name ? 'text-retro-accent' : 'text-zinc-600'} />
                    {renamingFile === file.name ? (
                      <input
                        autoFocus
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingFile(null); }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={submitRename}
                        className="bg-black border border-retro-accent rounded px-1 py-0.5 text-xs text-white w-full max-w-[200px]"
                      />
                    ) : (
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold truncate">{file.name}</span>
                        <span className="text-[9px] text-zinc-600 font-mono mt-0.5">{new Date(file.date).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startRename(file.name, e)}
                      className="p-1.5 hover:bg-white/10 rounded-md text-zinc-500 hover:text-white" title="Rename"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(file.name, e)}
                      className="p-1.5 hover:bg-red-500/20 rounded-md text-zinc-500 hover:text-red-400" title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-zinc-900/50 flex flex-col gap-3 flex-none">
          {mode === 'SAVE' && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase text-zinc-500 whitespace-nowrap">Filename:</span>
              <input
                ref={inputRef}
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 bg-black/40 border border-zinc-700 rounded-lg py-2 px-3 text-sm font-bold text-white focus:border-retro-accent focus:outline-none"
                placeholder="Enter filename..."
              />
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold uppercase text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={loading || (mode === 'SAVE' && !filename) || (mode === 'LOAD' && !selectedFile)}
              onClick={handleConfirm}
              className="flex-[2] py-2.5 sm:py-3 rounded-xl bg-retro-accent hover:bg-retro-highlight text-white font-bold uppercase text-xs transition-all shadow-lg active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {mode === 'SAVE' ? 'Save File' : 'Load File'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
