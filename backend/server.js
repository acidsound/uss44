/**
 * USS44 Backend
 * YouTube search and metadata server using Official YouTube Data API v3
 */

import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
// Support .env.local as well
if (existsSync('.env.local')) {
    dotenv.config({ path: '.env.local', override: true });
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow all localhost origins for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }

        // Allow Hugging Face Spaces
        if (origin.includes('.hf.space')) {
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}));
app.use(express.json());

/**
 * YouTube Data API v3 Service
 */
const YouTubeService = {
    apiKey: process.env.YOUTUBE_API_KEY,
    baseUrl: 'https://www.googleapis.com/youtube/v3',

    /**
     * Search for videos
     */
    async search(query, limit = 10) {
        if (!this.apiKey) {
            throw new Error('YOUTUBE_API_KEY is not configured');
        }

        const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            maxResults: limit,
            type: 'video',
            key: this.apiKey,
        });

        const response = await fetch(`${this.baseUrl}/search?${params}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`YouTube API Error: ${data.error.message}`);
        }

        // Get durations for search results in a second call since search doesn't include contentDetails
        const videoIds = data.items.map(item => item.id.videoId).join(',');
        const durations = await this.getVideoDurations(videoIds);

        return data.items.map(item => {
            const videoId = item.id.videoId;
            return {
                id: videoId,
                title: item.snippet.title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
                duration: durations[videoId] || 0,
                duration_string: this.formatISO8601Duration(durations[videoId] || 0),
                uploader: item.snippet.channelTitle,
                platform: 'youtube'
            };
        });
    },

    /**
     * Get video information by ID or URL
     */
    async getInfo(idOrUrl) {
        if (!this.apiKey) {
            throw new Error('YOUTUBE_API_KEY is not configured');
        }

        const videoId = this.extractVideoId(idOrUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube ID or URL');
        }

        const params = new URLSearchParams({
            part: 'snippet,contentDetails',
            id: videoId,
            key: this.apiKey,
        });

        const response = await fetch(`${this.baseUrl}/videos?${params}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`YouTube API Error: ${data.error.message}`);
        }

        const item = data.items?.[0];
        if (!item) return null;

        const durationSecs = this.parseISO8601Duration(item.contentDetails.duration);

        return {
            title: item.snippet.title,
            duration: durationSecs,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            uploader: item.snippet.channelTitle,
            platform: 'youtube',
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
        };
    },

    /**
     * Helper: Get durations for multiple video IDs
     */
    async getVideoDurations(videoIds) {
        if (!videoIds) return {};

        const params = new URLSearchParams({
            part: 'contentDetails',
            id: videoIds,
            key: this.apiKey,
        });

        const response = await fetch(`${this.baseUrl}/videos?${params}`);
        const data = await response.json();

        const durations = {};
        data.items?.forEach(item => {
            durations[item.id] = this.parseISO8601Duration(item.contentDetails.duration);
        });

        return durations;
    },

    /**
     * Helper: Extract Video ID from URL or ID string
     */
    extractVideoId(input) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = input.match(regex);
        return match ? match[1] : (input.length === 11 ? input : null);
    },

    /**
     * Helper: Parse ISO 8601 duration (e.g. PT4M20S) to seconds
     */
    parseISO8601Duration(duration) {
        const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
        const matches = duration.match(regex);
        const hours = parseInt(matches[1] || 0);
        const minutes = parseInt(matches[2] || 0);
        const seconds = parseInt(matches[3] || 0);
        return hours * 3600 + minutes * 60 + seconds;
    },

    /**
     * Helper: Format seconds to MM:SS or HH:MM:SS string
     */
    formatISO8601Duration(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

// ==================== ROUTES ====================

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

/**
 * Get video information
 */
app.post('/info', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            if (!process.env.YOUTUBE_API_KEY) {
                return res.status(403).json({ error: 'YOUTUBE_API_KEY is not configured on server' });
            }

            const info = await YouTubeService.getInfo(url);
            if (!info) {
                return res.status(404).json({ error: 'Video not found' });
            }
            return res.json(info);
        }

        return res.status(400).json({ error: 'Only YouTube is currently supported for metadata lookup' });

    } catch (error) {
        console.error('[info] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Search for videos (YouTube Data API v3)
 */
app.post('/search', async (req, res) => {
    const { query, limit = 10 } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    if (!process.env.YOUTUBE_API_KEY) {
        return res.status(403).json({ error: 'YOUTUBE_API_KEY is not configured on server' });
    }

    try {
        console.log(`[search] Query: "${query}", Limit: ${limit}`);
        const results = await YouTubeService.search(query, limit);
        res.json({ results });
    } catch (error) {
        console.error('[search] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Legacy extraction endpoints (Disabled)
 */
app.all(['/extract', '/stream', '/platforms'], (req, res) => {
    res.status(404).json({ error: 'Endpoint no longer available. yt-dlp related functionality has been removed.' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎧  USS44 Backend                                   ║
║                                                       ║
║   Server running on http://localhost:${PORT}            ║
║                                                       ║
║   Endpoints:                                          ║
║   • GET  /health    - Server status                   ║
║   • POST /info      - Get YouTube metadata            ║
║   • POST /search    - Search for YouTube videos       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

    // Check YouTube API key on startup
    const checkStatus = async () => {
        if (process.env.YOUTUBE_API_KEY) {
            console.log('🔍 Validating YouTube API Key...');
            try {
                // Perform a simple test request to validate the key (Rick Astley - Never Gonna Give You Up)
                const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${process.env.YOUTUBE_API_KEY}`);
                const data = await response.json();

                if (response.ok && !data.error) {
                    console.log('✅ YouTube API Key is VALID');
                } else {
                    const errorMsg = data.error?.message || 'Invalid Response';
                    console.error(`❌ YouTube API Key is INVALID: ${errorMsg}`);
                }
            } catch (error) {
                console.error(`❌ YouTube API Key validation failed: ${error.message}`);
            }
        } else {
            console.warn('⚠️  YOUTUBE_API_KEY is NOT set in .env or .env.local');
        }
    };

    checkStatus();
});
