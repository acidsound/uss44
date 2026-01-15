/**
 * oEmbed Service
 * Fetches metadata (thumbnails, titles) from social media URLs
 * Uses backend proxy to avoid CORS issues
 */

import { ParsedUrl, SocialPlatform, getPlatformName } from '../utils/urlParser';

// Backend API configuration
const BACKEND_URL = import.meta.env.VITE_DIG_BACKEND_URL || 'http://localhost:3001';

export interface OEmbedData {
    title: string;
    author_name?: string;
    author_url?: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
    html?: string;
    provider_name: string;
    provider_url?: string;
    duration?: string;
    durationSeconds?: number;
    embedUrl?: string;
    type?: string;
}

/**
 * Fetch metadata using the backend /info endpoint
 * This avoids CORS issues with external APIs
 */
export async function fetchOEmbed(parsed: ParsedUrl): Promise<OEmbedData | null> {
    if (!parsed.isValid) return null;

    try {
        // Use backend as proxy to avoid CORS
        const response = await fetch(`${BACKEND_URL}/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: parsed.originalUrl }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.error) {
                console.warn('Backend info error:', data.error);
                return null;
            }
            return {
                title: data.title || `${getPlatformName(parsed.platform)} Video`,
                author_name: data.uploader,
                thumbnail_url: data.thumbnail,
                duration: data.duration ? formatDuration(data.duration) : undefined,
                durationSeconds: data.duration,
                embedUrl: data.embedUrl,
                provider_name: data.platform || parsed.platform,
            };
        }

        return null;
    } catch (error) {
        console.warn('oEmbed fetch error, using fallback:', error);
        // Return a minimal fallback
        return null;
    }
}

/**
 * Format duration from seconds to MM:SS
 */
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get a high-quality thumbnail URL
 * Uses predictable patterns for known platforms
 */
export function getHighQualityThumbnail(parsed: ParsedUrl, oembedData?: OEmbedData | null): string | null {
    if (parsed.platform === 'youtube' && parsed.videoId) {
        // YouTube provides predictable thumbnail URLs
        return `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg`;
    }

    if (parsed.platform === 'rutube' && parsed.videoId) {
        // Rutube thumbnail pattern
        return `https://pic.rutube.ru/video/${parsed.videoId}/`;
    }

    // Fallback to oEmbed thumbnail
    return oembedData?.thumbnail_url || null;
}

/**
 * Create a preview item for the Dig Network UI
 */
export interface DigPreviewItem {
    id: string;
    platform: SocialPlatform;
    url: string;
    title: string;
    author?: string;
    thumbnail: string | null;
    duration?: string;
    durationSeconds?: number;
    embedUrl?: string;
    isLoading: boolean;
    error?: string;
}

export async function createDigPreview(parsed: ParsedUrl): Promise<DigPreviewItem> {
    const id = `dig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const preview: DigPreviewItem = {
        id,
        platform: parsed.platform,
        url: parsed.originalUrl,
        title: 'Loading...',
        thumbnail: getHighQualityThumbnail(parsed), // Get thumbnail immediately if possible
        isLoading: true,
    };

    try {
        const oembedData = await fetchOEmbed(parsed);

        if (oembedData) {
            preview.title = oembedData.title;
            preview.author = oembedData.author_name;
            preview.thumbnail = oembedData.thumbnail_url || getHighQualityThumbnail(parsed, oembedData);
            preview.duration = oembedData.duration;
            preview.durationSeconds = oembedData.durationSeconds;
            preview.embedUrl = oembedData.embedUrl;
        } else {
            // Use fallback values
            preview.title = `${getPlatformName(parsed.platform)} Video`;
            preview.thumbnail = getHighQualityThumbnail(parsed);
        }
        preview.isLoading = false;
    } catch (error) {
        preview.title = `${getPlatformName(parsed.platform)} Video`;
        preview.thumbnail = getHighQualityThumbnail(parsed);
        preview.isLoading = false;
        preview.error = 'Failed to load metadata';
    }

    return preview;
}
