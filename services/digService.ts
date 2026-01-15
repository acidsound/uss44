/**
 * Dig Service
 * Handles audio extraction from social media URLs
 */

import { ParsedUrl, SocialPlatform } from '../utils/urlParser';

// Backend API configuration
const BACKEND_URL = import.meta.env.VITE_DIG_BACKEND_URL || 'http://localhost:3001';

export interface ExtractionResult {
    success: boolean;
    audioUrl?: string;
    audioBlob?: Blob;
    duration?: number;
    title?: string;
    error?: string;
}

export interface ExtractionProgress {
    stage: 'init' | 'downloading' | 'extracting' | 'encoding' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
}

type ProgressCallback = (progress: ExtractionProgress) => void;

export interface ExtractionOptions {
    startTime?: number; // seconds
    endTime?: number;   // seconds
}

/**
 * Extract audio from a social media URL using the backend service
 */
export async function extractAudio(
    parsed: ParsedUrl,
    onProgress?: ProgressCallback,
    options?: ExtractionOptions
): Promise<ExtractionResult> {
    if (!parsed.isValid) {
        return { success: false, error: 'Invalid URL' };
    }

    onProgress?.({ stage: 'init', progress: 0, message: 'Initializing...' });

    try {
        // Check backend health first
        const healthCheck = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        }).catch(() => null);

        if (!healthCheck?.ok) {
            return {
                success: false,
                error: 'The server is not running'
            };
        }

        onProgress?.({ stage: 'downloading', progress: 20, message: 'Fetching video...' });

        // Build request body with optional time range
        const requestBody: Record<string, unknown> = {
            url: parsed.originalUrl,
            platform: parsed.platform,
            format: 'mp3',
            quality: '192',
        };

        // Add time range if specified
        if (options?.startTime !== undefined && options?.endTime !== undefined) {
            requestBody.startTime = options.startTime;
            requestBody.endTime = options.endTime;
        }

        // Request audio extraction
        const response = await fetch(`${BACKEND_URL}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                error: errorData.error || `Extraction failed: ${response.status}`
            };
        }

        onProgress?.({ stage: 'extracting', progress: 60, message: 'Extracting audio...' });

        const data = await response.json();

        if (data.audioUrl) {
            onProgress?.({ stage: 'encoding', progress: 80, message: 'Preparing audio...' });

            // Fetch the actual audio file
            const audioResponse = await fetch(data.audioUrl);
            if (!audioResponse.ok) {
                return { success: false, error: 'Failed to download extracted audio' };
            }

            const audioBlob = await audioResponse.blob();

            onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });

            return {
                success: true,
                audioUrl: data.audioUrl,
                audioBlob,
                duration: data.duration,
                title: data.title,
            };
        }

        // If backend returns blob directly
        if (data.audio) {
            const audioBlob = new Blob(
                [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
                { type: 'audio/mp3' }
            );

            onProgress?.({ stage: 'complete', progress: 100, message: 'Done!' });

            return {
                success: true,
                audioBlob,
                duration: data.duration,
                title: data.title,
            };
        }

        return { success: false, error: 'Unexpected response format' };

    } catch (error) {
        console.error('Extraction error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Extraction failed'
        };
    }
}

/**
 * Check if the extraction backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get supported platforms from the backend
 */
export async function getSupportedPlatforms(): Promise<SocialPlatform[]> {
    try {
        const response = await fetch(`${BACKEND_URL}/platforms`);
        if (response.ok) {
            const data = await response.json();
            return data.platforms || [];
        }
    } catch {
        // Fallback to known platforms
    }
    return ['youtube', 'tiktok', 'instagram', 'rutube'];
}

/**
 * Search for videos on a platform (defaults to YouTube)
 */
export async function searchVideos(
    query: string,
    platform: SocialPlatform = 'youtube',
    limit: number = 10
): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    try {
        const response = await fetch(`${BACKEND_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, platform, limit }),
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

export interface SearchResult {
    id: string;
    title: string;
    url: string;
    thumbnail: string | null;
    duration: number | null;
    duration_string: string | null;
    uploader: string | null;
    platform: string;
}
