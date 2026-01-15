/**
 * Social Media URL Parser
 * Detects and extracts information from various social media platform URLs
 */

export type SocialPlatform = 'youtube' | 'tiktok' | 'instagram' | 'xiaohongshu' | 'rutube' | 'unknown';

export interface ParsedUrl {
    platform: SocialPlatform;
    originalUrl: string;
    videoId: string | null;
    isValid: boolean;
}

const PLATFORM_PATTERNS: Record<SocialPlatform, RegExp[]> = {
    youtube: [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ],
    tiktok: [
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
        /vm\.tiktok\.com\/(\w+)/,
        /tiktok\.com\/t\/(\w+)/,
    ],
    instagram: [
        /instagram\.com\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/,
        /instagr\.am\/(?:p|reel)\/([a-zA-Z0-9_-]+)/,
    ],
    xiaohongshu: [
        /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/,
        /xhslink\.com\/([a-zA-Z0-9]+)/,
    ],
    rutube: [
        /rutube\.ru\/video\/([a-zA-Z0-9]+)/,
        /rutube\.ru\/shorts\/([a-zA-Z0-9]+)/,
    ],
    unknown: [],
};

export function parseUrl(url: string): ParsedUrl {
    const trimmedUrl = url.trim();

    for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS) as [SocialPlatform, RegExp[]][]) {
        if (platform === 'unknown') continue;

        for (const pattern of patterns) {
            const match = trimmedUrl.match(pattern);
            if (match) {
                return {
                    platform,
                    originalUrl: trimmedUrl,
                    videoId: match[1] || null,
                    isValid: true,
                };
            }
        }
    }

    // Check if it's a valid URL at all
    try {
        new URL(trimmedUrl);
        return {
            platform: 'unknown',
            originalUrl: trimmedUrl,
            videoId: null,
            isValid: true,
        };
    } catch {
        return {
            platform: 'unknown',
            originalUrl: trimmedUrl,
            videoId: null,
            isValid: false,
        };
    }
}

export function getPlatformColor(platform: SocialPlatform): string {
    const colors: Record<SocialPlatform, string> = {
        youtube: '#FF0000',
        tiktok: '#00F2EA',
        instagram: '#E4405F',
        xiaohongshu: '#FE2C55',
        rutube: '#00B4FF',
        unknown: '#888888',
    };
    return colors[platform];
}

export function getPlatformName(platform: SocialPlatform): string {
    const names: Record<SocialPlatform, string> = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        xiaohongshu: '小红书',
        rutube: 'Rutube',
        unknown: 'Unknown',
    };
    return names[platform];
}

export function getEmbedUrl(parsed: ParsedUrl): string | null {
    if (!parsed.isValid || !parsed.videoId) return null;

    switch (parsed.platform) {
        case 'youtube':
            return `https://www.youtube.com/embed/${parsed.videoId}`;
        case 'rutube':
            return `https://rutube.ru/play/embed/${parsed.videoId}`;
        default:
            return null;
    }
}
