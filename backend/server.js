/**
 * USS44 Dig Backend
 * Audio extraction server using yt-dlp
 */

import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;
const TEMP_DIR = join(__dirname, 'temp');

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}

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

// Serve static audio files
app.use('/audio', express.static(TEMP_DIR, {
    setHeaders: (res) => {
        res.set('Content-Type', 'audio/mpeg');
        res.set('Accept-Ranges', 'bytes');
    }
}));

// Supported platforms
const SUPPORTED_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'xiaohongshu', 'rutube'];

/**
 * Check if yt-dlp is installed
 */
async function checkYtDlp() {
    try {
        await execAsync('yt-dlp --version');
        return true;
    } catch {
        return false;
    }
}

/**
 * Get video info without downloading
 */
async function getVideoInfo(url) {
    try {
        const { stdout } = await execAsync(
            `yt-dlp --dump-json --no-download "${url}"`,
            { timeout: 30000 }
        );
        return JSON.parse(stdout);
    } catch (error) {
        console.error('Failed to get video info:', error.message);
        return null;
    }
}

/**
 * Extract audio from URL with optional time range
 */
async function extractAudio(url, outputPath, options = {}) {
    const { format = 'mp3', quality = '192', startTime, endTime } = options;

    return new Promise((resolve, reject) => {
        const args = [
            '-x',                          // Extract audio
            '--audio-format', format,      // Output format
            '--audio-quality', quality + 'K', // Audio quality
            '--no-playlist',               // Don't download playlists
            '--no-warnings',               // Suppress warnings
            '--no-check-certificate',      // Skip certificate verification
        ];

        // Add time range if specified (yt-dlp 2021.12.01+)
        if (startTime !== undefined && endTime !== undefined) {
            // Format: *start-end for time range extraction
            const startStr = formatTimeForYtDlp(startTime);
            const endStr = formatTimeForYtDlp(endTime);
            args.push('--download-sections', `*${startStr}-${endStr}`);
            console.log(`[yt-dlp] Time range: ${startStr} to ${endStr}`);
        }

        args.push('-o', outputPath);     // Output path
        args.push(url);                  // Source URL

        console.log(`[yt-dlp] Extracting: ${url}`);
        console.log(`[yt-dlp] Args: yt-dlp ${args.join(' ')}`);

        const process = spawn('yt-dlp', args);

        let stderr = '';

        process.stdout.on('data', (data) => {
            console.log(`[yt-dlp] ${data.toString()}`);
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(`[yt-dlp stderr] ${data.toString()}`);
        });

        process.on('close', (code) => {
            if (code === 0) {
                // yt-dlp might add extension, check for file
                const possiblePaths = [
                    outputPath,
                    outputPath + '.' + format,
                    outputPath.replace(/\.[^.]+$/, '.' + format),
                ];

                for (const p of possiblePaths) {
                    if (existsSync(p)) {
                        resolve(p);
                        return;
                    }
                }

                reject(new Error('Output file not found after extraction'));
            } else {
                reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
            }
        });

        process.on('error', (error) => {
            reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
        });
    });
}

/**
 * Format seconds to HH:MM:SS for yt-dlp
 */
function formatTimeForYtDlp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clean up old temp files (older than 1 hour)
 */
function cleanupTempFiles() {
    try {
        const files = require('fs').readdirSync(TEMP_DIR);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        for (const file of files) {
            const filePath = join(TEMP_DIR, file);
            const stats = statSync(filePath);
            if (stats.mtimeMs < oneHourAgo) {
                unlinkSync(filePath);
                console.log(`[cleanup] Deleted old file: ${file}`);
            }
        }
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

// Run cleanup every 30 minutes
setInterval(cleanupTempFiles, 30 * 60 * 1000);

// ==================== ROUTES ====================

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
    const ytdlpInstalled = await checkYtDlp();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ytdlp: ytdlpInstalled,
    });
});

/**
 * Get supported platforms
 */
app.get('/platforms', (req, res) => {
    res.json({ platforms: SUPPORTED_PLATFORMS });
});

/**
 * Get video information
 */
app.post('/info', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const info = await getVideoInfo(url);

    if (!info) {
        return res.status(500).json({ error: 'Failed to get video info' });
    }

    // Generate embed URL based on platform
    let embedUrl = null;
    if (info.webpage_url) {
        if (info.extractor === 'youtube' && info.id) {
            embedUrl = `https://www.youtube.com/embed/${info.id}`;
        } else if (info.extractor === 'rutube' && info.id) {
            embedUrl = `https://rutube.ru/play/embed/${info.id}`;
        } else if (info.extractor === 'tiktok' && info.id) {
            embedUrl = `https://www.tiktok.com/embed/v2/${info.id}`;
        }
    }

    res.json({
        title: info.title,
        duration: info.duration,
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        platform: info.extractor,
        embedUrl,
    });
});

/**
 * Search for videos (YouTube only for now as it supports search natively)
 */
app.post('/search', async (req, res) => {
    const { query, platform = 'youtube', limit = 10 } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        console.log(`[search] Query: "${query}", Platform: ${platform}`);

        // Only YouTube search is officially supported by yt-dlp via prefix
        const searchPrefix = platform === 'youtube' ? 'ytsearch' : 'ytsearch'; // Fallback to YouTube
        const searchUrl = `${searchPrefix}${limit}:${query}`;

        const { stdout } = await execAsync(
            `yt-dlp --dump-json --flat-playlist --playlist-end ${limit} --no-warning "${searchUrl}"`,
            { timeout: 30000 }
        );

        const results = stdout.trim().split('\n')
            .map(line => {
                try {
                    const info = JSON.parse(line);
                    return {
                        id: info.id,
                        title: info.title,
                        url: info.webpage_url || info.url,
                        thumbnail: info.thumbnails?.[0]?.url || info.thumbnail,
                        duration: info.duration,
                        duration_string: info.duration_string,
                        uploader: info.uploader || info.channel,
                        platform: info.extractor || 'youtube'
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(item => item !== null);

        res.json({ results });
    } catch (error) {
        console.error('[search] Error:', error.message);
        res.status(500).json({ error: 'Failed to search for videos' });
    }
});

/**
 * Extract audio from URL
 */
app.post('/extract', async (req, res) => {
    const { url, format = 'mp3', quality = '192', startTime, endTime } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate time range if provided
    if (startTime !== undefined && endTime !== undefined) {
        const duration = endTime - startTime;
        if (duration <= 0) {
            return res.status(400).json({ error: 'End time must be greater than start time' });
        }
        if (duration > 180) {
            return res.status(400).json({ error: 'Maximum duration is 3 minutes (180 seconds)' });
        }
        console.log(`[extract] Time range requested: ${startTime}s to ${endTime}s (${duration}s)`);
    }

    // Check yt-dlp availability
    const ytdlpAvailable = await checkYtDlp();
    if (!ytdlpAvailable) {
        return res.status(500).json({
            error: 'yt-dlp is not installed. Install with: brew install yt-dlp'
        });
    }

    const fileId = randomBytes(8).toString('hex');
    const outputBase = join(TEMP_DIR, fileId);

    try {
        // Get video info first
        const info = await getVideoInfo(url);

        // Extract audio with optional time range
        const outputPath = await extractAudio(url, outputBase, {
            format,
            quality,
            startTime,
            endTime
        });
        const fileName = outputPath.split('/').pop();

        // Generate URL for the audio file
        const audioUrl = `http://localhost:${PORT}/audio/${fileName}`;

        console.log(`[extract] Success: ${audioUrl}`);

        res.json({
            success: true,
            audioUrl,
            title: info?.title || 'Unknown',
            duration: info?.duration,
            thumbnail: info?.thumbnail,
        });

    } catch (error) {
        console.error('[extract] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Stream audio directly (alternative to file URL)
 */
app.get('/stream', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const fileId = randomBytes(8).toString('hex');
    const outputBase = join(TEMP_DIR, fileId);

    try {
        const outputPath = await extractAudio(url, outputBase);

        const stat = statSync(outputPath);
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': stat.size,
            'Accept-Ranges': 'bytes',
        });

        const stream = createReadStream(outputPath);
        stream.pipe(res);

        // Clean up after streaming
        stream.on('end', () => {
            setTimeout(() => {
                try { unlinkSync(outputPath); } catch { }
            }, 60000); // Delete after 1 minute
        });

    } catch (error) {
        console.error('[stream] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎧  USS44 Dig Backend                               ║
║                                                       ║
║   Server running on http://localhost:${PORT}            ║
║                                                       ║
║   Endpoints:                                          ║
║   • GET  /health    - Server status                   ║
║   • GET  /platforms - Supported platforms             ║
║   • POST /info      - Get video metadata              ║
║   • POST /extract   - Extract audio from URL          ║
║   • GET  /stream    - Stream audio directly           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

    // Check yt-dlp on startup
    checkYtDlp().then((installed) => {
        if (installed) {
            console.log('✅ yt-dlp is installed and ready');
        } else {
            console.warn('⚠️  yt-dlp is NOT installed!');
            console.warn('   Install with: brew install yt-dlp');
        }
    });
});
