
import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingOverlay: React.FC = () => {
  return (
    <div id="loading-overlay" className="absolute inset-0 z-[100] bg-retro-bg/80 backdrop-blur-lg flex flex-col items-center justify-center">
      <Loader2 id="loading-spinner" className="w-14 h-14 text-retro-accent animate-spin mb-4" />
      <p id="loading-status-text" className="text-xs text-retro-accent font-extrabold uppercase tracking-[0.2em]">Restoring Session Data...</p>
    </div>
  );
};
