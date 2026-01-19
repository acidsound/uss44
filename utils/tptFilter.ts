
/**
 * TPT (Topology-Preserving Transform) State Variable Filter
 * Identical algorithm to VoiceProcessor.js for consistent sound
 */

interface TPTSVFState {
    s1: number;
    s2: number;
}

/**
 * Apply TPT SVF Lowpass filter to an AudioBuffer
 * Returns a new AudioBuffer with filtered audio
 */
export const applyTPTSVFFilter = (
    buffer: AudioBuffer,
    cutoff: number,
    resonance: number,
    sampleRate: number = 44100
): AudioBuffer => {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length;

    // Create output buffer
    const ctx = new OfflineAudioContext(numChannels, length, sampleRate);
    const outputBuffer = ctx.createBuffer(numChannels, length, sampleRate);

    // Filter coefficient calculation
    const cutoffFreq = Math.max(20, Math.min(cutoff, sampleRate * 0.49));
    const g = Math.tan(Math.PI * cutoffFreq / sampleRate);
    const Q = Math.max(0.1, resonance);
    const k = 1.0 / Q;

    // Precompute TPT solver coefficients
    const a1 = 1.0 / (1.0 + g * (g + k));
    const a2 = g * a1;

    for (let ch = 0; ch < numChannels; ch++) {
        const input = buffer.getChannelData(ch);
        const output = outputBuffer.getChannelData(ch);

        // Filter state per channel
        let s1 = 0;
        let s2 = 0;

        for (let i = 0; i < length; i++) {
            const v0 = input[i];

            // TPT SVF Solver for Low Pass (v2)
            const v3 = v0 - s2;
            const v1 = a1 * s1 + a2 * v3;
            const v2 = s2 + g * v1;

            // Update state (integrators)
            s1 = 2 * v1 - s1;
            s2 = 2 * v2 - s2;

            // Safety check
            output[i] = isFinite(v2) ? v2 : v0;
        }
    }

    return outputBuffer;
};

/**
 * Apply filter to a portion of the buffer (with start/end markers)
 * and return a new buffer for that segment
 */
export const extractAndFilterSegment = (
    buffer: AudioBuffer,
    start: number,
    end: number,
    cutoff: number,
    resonance: number,
    sampleRate: number = 44100
): AudioBuffer => {
    const startFrame = Math.floor(start * buffer.length);
    const endFrame = Math.floor(end * buffer.length);
    const segmentLength = endFrame - startFrame;

    if (segmentLength <= 0) {
        // Return empty buffer
        const ctx = new OfflineAudioContext(buffer.numberOfChannels, 1, sampleRate);
        return ctx.createBuffer(buffer.numberOfChannels, 1, sampleRate);
    }

    const numChannels = buffer.numberOfChannels;
    const ctx = new OfflineAudioContext(numChannels, segmentLength, sampleRate);
    const segmentBuffer = ctx.createBuffer(numChannels, segmentLength, sampleRate);

    // Copy segment data
    for (let ch = 0; ch < numChannels; ch++) {
        const sourceData = buffer.getChannelData(ch);
        const destData = segmentBuffer.getChannelData(ch);
        for (let i = 0; i < segmentLength; i++) {
            destData[i] = sourceData[startFrame + i] || 0;
        }
    }

    // Skip filter if cutoff is wide open and no resonance boost
    if (cutoff >= sampleRate * 0.45 && resonance <= 1.0) {
        return segmentBuffer;
    }

    return applyTPTSVFFilter(segmentBuffer, cutoff, resonance, sampleRate);
};
