
import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface RenameModalProps {
  initialName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ initialName, onSave, onClose }) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay to ensure the modal animation doesn't interfere with focus
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    onSave(name.toUpperCase());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[#1e1e22] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col gap-4 scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Rename Pad</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-black/40 border border-zinc-700 rounded-xl px-4 py-4 text-xl font-extrabold text-white uppercase focus:border-retro-accent focus:outline-none placeholder:text-zinc-700 tracking-tight"
          placeholder="ENTER NAME"
        />
        
        <div className="flex gap-3 mt-2">
            <button 
              onClick={onClose}
              className="flex-1 bg-zinc-800 text-zinc-300 font-extrabold uppercase py-3 rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 bg-white text-black font-extrabold uppercase py-3 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} /> Save
            </button>
        </div>
      </div>
    </div>
  );
};
