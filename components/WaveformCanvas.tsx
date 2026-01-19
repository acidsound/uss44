import React, { useRef, useEffect } from 'react';

interface WaveformCanvasProps {
    /** Waveform data array (peak values 0-1) */
    waveform: number[];
    /** Optional AudioBuffer for high-resolution rendering */
    buffer?: AudioBuffer | null;
    /** Optional view range for zooming (0-1) */
    viewStart?: number;
    viewEnd?: number;
    /** Styling */
    className?: string;
    /** Waveform color */
    color?: string;
    /** Background color */
    backgroundColor?: string;
    /** Show center line */
    showCenterLine?: boolean;
    /** Show grid */
    showGrid?: boolean;
    /** Playhead position (0-1), null to hide */
    playheadPosition?: number | null;
    /** Playhead color */
    playheadColor?: string;
    /** Show ruler with time markers */
    showRuler?: boolean;
    /** Total duration for ruler context */
    duration?: number;
}

/**
 * Reusable Canvas-based Waveform component
 * Used in WaveformEditor and RenderModal
 */
export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
    waveform,
    buffer,
    viewStart = 0,
    viewEnd = 1,
    className = '',
    color = '#ff3c6a',
    backgroundColor = '#0a0a0c',
    showCenterLine = true,
    showGrid = false,
    playheadPosition = null,
    playheadColor = '#ffffff',
    showRuler = false,
    duration = 0
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const RULER_HEIGHT = showRuler ? 18 : 0;
        const waveformHeight = height - RULER_HEIGHT;
        const range = viewEnd - viewStart;

        // Ruler (optional)
        if (showRuler) {
            ctx.fillStyle = 'rgba(20, 20, 23, 0.8)';
            ctx.fillRect(0, 0, width, RULER_HEIGHT);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(width, RULER_HEIGHT); ctx.stroke();

            ctx.font = '8px "Inter", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.textAlign = 'center';
            const numTicks = 10;
            for (let i = 0; i <= numTicks; i++) {
                const x = (i / numTicks) * width;
                const normalizedPos = viewStart + (i / numTicks) * (viewEnd - viewStart);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER_HEIGHT); ctx.stroke();

                if (duration > 0 && i > 0 && i < numTicks) {
                    const label = (normalizedPos * duration).toFixed(2) + 's';
                    ctx.fillText(label, x, RULER_HEIGHT - 6);
                }
            }
        }

        ctx.save();
        ctx.translate(0, RULER_HEIGHT);

        // Grid (optional)
        if (showGrid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 20; i++) {
                const x = (i / 20) * width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, waveformHeight);
                ctx.stroke();
            }
        }

        // Center line (optional)
        if (showCenterLine) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, waveformHeight / 2);
            ctx.lineTo(width, waveformHeight / 2);
            ctx.stroke();
        }

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        if (buffer) {
            // High-resolution rendering from AudioBuffer
            const data = buffer.getChannelData(0);
            const startIdx = Math.floor(viewStart * data.length);
            const endIdx = Math.floor(viewEnd * data.length);
            const visibleSamples = endIdx - startIdx;

            for (let x = 0; x < width; x++) {
                const sampleIdx = startIdx + Math.floor((x / width) * visibleSamples);
                if (sampleIdx >= data.length) break;
                const val = data[sampleIdx];
                const y = (0.5 - val * 0.45) * waveformHeight;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
        } else if (waveform && waveform.length > 0) {
            // Render from cached waveform peaks (bar style)
            const startIdx = Math.floor(viewStart * waveform.length);
            const endIdx = Math.floor(viewEnd * waveform.length);
            const visiblePoints = endIdx - startIdx;

            for (let x = 0; x < width; x++) {
                const pointIdx = startIdx + Math.floor((x / width) * visiblePoints);
                if (pointIdx >= waveform.length) break;
                const val = waveform[pointIdx];
                const h = val * (waveformHeight / 2) * 0.9;
                ctx.moveTo(x, waveformHeight / 2 - h);
                ctx.lineTo(x, waveformHeight / 2 + h);
            }
        }
        ctx.stroke();

        // Playhead
        if (playheadPosition !== null) {
            const playX = ((playheadPosition - viewStart) / range) * width;
            if (playX >= 0 && playX <= width) {
                ctx.strokeStyle = playheadColor;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 4;
                ctx.shadowColor = playheadColor;
                ctx.beginPath();
                ctx.moveTo(playX, 0);
                ctx.lineTo(playX, waveformHeight);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();

    }, [waveform, buffer, viewStart, viewEnd, color, backgroundColor, showCenterLine, showGrid, playheadPosition, playheadColor, showRuler, duration]);

    return (
        <canvas
            ref={canvasRef}
            className={`w-full h-full ${className}`}
        />
    );
};
