
/**
 * Precise BPM detection using Autocorrelation on Energy Envelope.
 * This approach is more musically natural as it looks for periodicities 
 * rather than just counting peaks, significantly reducing jitter.
 */
export const detectBPM = (buffer: AudioBuffer, startFactor: number = 0, endFactor: number = 1): number | null => {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    const startIdx = Math.floor(startFactor * data.length);
    const endIdx = Math.floor(endFactor * data.length);
    const sliceLen = endIdx - startIdx;

    if (sliceLen < sampleRate * 0.5) return null; // Too short to detect BPM reliably

    // 1. Extract energy envelope (approx 100Hz resolution)
    const winSize = Math.floor(sampleRate / 100);
    const envelope = [];
    for (let i = startIdx; i < endIdx; i += winSize) {
        let sum = 0;
        const chunkEnd = Math.min(i + winSize, endIdx);
        for (let j = i; j < chunkEnd; j++) {
            sum += Math.abs(data[j]);
        }
        envelope.push(sum / (chunkEnd - i));
    }

    // 2. Perform Autocorrelation on the envelope
    // Focus on 60-180 BPM lags
    const minLag = Math.floor((60 / 180) * 100);
    const maxLag = Math.floor((60 / 60) * 100);
    const results: { lag: number, score: number }[] = [];

    for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < envelope.length - lag; i++) {
            sum += envelope[i] * envelope[i + lag];
            count++;
        }
        results.push({ lag, score: count > 0 ? sum / count : 0 });
    }

    if (results.length === 0) return null;

    // 3. Peak picking with "Natural Tempo" weighting
    // Favors tempos around 120BPM if scores are similar
    const peaks: { bpm: number, score: number }[] = [];
    for (let i = 1; i < results.length - 1; i++) {
        if (results[i].score > results[i - 1].score && results[i].score > results[i + 1].score) {
            const bpm = 6000 / results[i].lag;
            // Tempo bias: subtle preference for 70-140 range
            const bias = 1.0 - Math.abs(Math.log2(bpm / 120)) * 0.1;
            peaks.push({ bpm, score: results[i].score * bias });
        }
    }

    if (peaks.length === 0) return null;

    // 4. Return the most periodically dominant BPM
    peaks.sort((a, b) => b.score - a.score);
    return Math.round(peaks[0].bpm);
};

/**
 * Calculates BPM based solely on the duration of a loop.
 * Useful for matching samples to a sequencer's grid.
 * Assumes the loop represents N beats (1, 2, 4, 8, etc.)
 */
export const calculateLoopBPM = (duration: number): number | null => {
    if (duration <= 0) return null;

    // We try to find a beat count (1, 2, 4, 8, 16...) that results in 
    // a BPM within a "musical" range (roughly 70 to 160 BPM).
    let beats = 4; // Start assuming 1 bar (4 beats)
    let bpm = (60 * beats) / duration;

    while (bpm < 70 && beats < 64) {
        beats *= 2;
        bpm = (60 * beats) / duration;
    }
    while (bpm > 160 && beats > 1) {
        beats /= 2;
        bpm = (60 * beats) / duration;
    }

    // Return with 1 decimal precision for loop matching
    return Math.round(bpm * 10) / 10;
};

