---
title: USS44 Dig Backend
emoji: 🎧
colorFrom: red
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# USS44 Dig Backend

Audio extraction backend for the USS44 Social Sampler.

## Features

- Extract audio from YouTube, TikTok, Instagram, Xiaohongshu, Rutube
- Powered by yt-dlp
- RESTful API with CORS support

## API Endpoints

- `GET /health` - Server health check
- `GET /platforms` - List supported platforms
- `POST /info` - Get video metadata
- `POST /search` - Search for videos (YouTube search fallback)
- `POST /extract` - Extract audio from URL (supports time ranges)

## Deployment to Hugging Face Spaces

This backend is designed to run on Hugging Face Spaces using the **Docker SDK**.

1. Create a new Space on Hugging Face.
2. Select **Docker** as the SDK.
3. Push the contents of the `backend` folder to the Space repository.

The `Dockerfile` will automatically:
- Install `ffmpeg`
- Install `yt-dlp`
- Install Node.js
- Start the server on port 7860 (default for HF Spaces)

## Usage

```bash
curl -X POST https://your-space.hf.space/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=..."}'
```
