
/**
 * Utility to convert AudioBuffer to a WAV file Blob.
 */
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const bufferLength = buffer.length;
    const dataSize = bufferLength * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write actual audio data
    const offset = 44;
    if (numChannels === 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        for (let i = 0; i < bufferLength; i++) {
            // Channel 1
            let sL = Math.max(-1, Math.min(1, left[i]));
            view.setInt16(offset + i * 4, sL < 0 ? sL * 0x8000 : sL * 0x7FFF, true);
            // Channel 2
            let sR = Math.max(-1, Math.min(1, right[i]));
            view.setInt16(offset + i * 4 + 2, sR < 0 ? sR * 0x8000 : sR * 0x7FFF, true);
        }
    } else {
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < bufferLength; i++) {
            let s = Math.max(-1, Math.min(1, channel[i]));
            view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
};
