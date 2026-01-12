import React, { useRef, useEffect } from 'react';
import { useAudioStore } from '../stores/audioStore';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const micAnalyser = useAudioStore((state) => state.micAnalyser);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !micAnalyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = micAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      micAnalyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(255, 30, 86, ${0.4 + (barHeight / canvas.height)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [micAnalyser]);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={28}
      className="w-full h-full block opacity-60"
    />
  );
};