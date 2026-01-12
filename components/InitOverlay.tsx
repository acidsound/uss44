
import React from 'react';
import { Activity } from 'lucide-react';

export const InitOverlay: React.FC = () => {
  return (
    <div id="init-overlay" className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm">
      <Activity id="init-activity-icon" className="w-20 h-20 text-retro-accent animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,30,86,0.6)]" />
      <h2 id="init-logo-text" className="text-3xl font-extrabold tracking-tighter uppercase mb-1 glow-red">
        USS<span className="text-retro-accent">44</span>
      </h2>
      <p id="init-subtitle" className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mb-10">
        Social Media Sampler
      </p>
      <p id="init-tap-prompt" className="text-sm text-retro-muted uppercase font-extrabold tracking-[0.2em] animate-bounce">
        Tap to Initialize
      </p>
    </div>
  );
};
