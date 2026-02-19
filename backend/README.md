---
title: USS44 Dig Backend
emoji: 🎧
colorFrom: red
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# USS44 Backend

Backend service for the USS44 Social Sampler, providing YouTube search and metadata via the Official YouTube Data API v3.

## Features

- Search for YouTube videos
- Retrieve video metadata (titles, durations, thumbnails)
- Powered by Official YouTube Data API v3

## Setup & Configuration

To use the search and metadata features, you must provide a YouTube Data API v3 Key.

### 1. Obtain a YouTube API Key

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (or select an existing one).
3.  Navigate to **APIs & Services > Library**.
4.  Search for **YouTube Data API v3** and enable it.
5.  Go to **APIs & Services > Credentials**.
6.  Click **Create Credentials > API Key**.
7.  Copy your new API Key.

### 2. Configure Environment

1.  Create a `.env` (or `.env.local`) file in the `backend/` directory.
2.  Add your API Key:
    ```env
    YOUTUBE_API_KEY=your_actual_api_key_here
    PORT=3001
    ```

## API Endpoints

- `GET /health` - Server health check
- `POST /info` - Get YouTube video metadata
- `POST /search` - Search for YouTube videos

## Usage

```bash
# Search for videos
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "acid house"}'

# Get video info
curl -X POST http://localhost:3001/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```
