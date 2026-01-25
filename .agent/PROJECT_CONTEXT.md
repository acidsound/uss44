# uss44 - Project Context

## Project Overview

**USS44** is a high-performance web-based sampler and sequencer designed for rapid content creation.
- **Type**: Sampler / Sequencer / Social Audio Tool
- **Live URL**: https://acidsound.github.io/uss44/
- **Repository**: https://github.com/acidsound/uss44

## Architecture

### Audio Engine
- **Core**: Web Audio API + AudioWorklet
- **Location**: `public/worklets/`
- **Features**:
  - Real-time pitch shifting (0.1x - 4x)
  - SVF Filter (Cutoff, Resonance)
  - AD Envelope per pad

### Backend (Dig Network)
- **Location**: `backend/`
- **Stack**: Node.js + yt-dlp + ffmpeg
- **Purpose**: Server-side audio extraction for "Digging" feature

### State Management
- **Library**: Zustand
- **Stores**:
  - `audioStore`: AudioContext & Worklet management
  - `sequencerStore`: Pattern & Song data
  - `uiStore`: Interface state

### Data Persistence
- **Technology**: IndexedDB
- **Module**: `services/dbService.ts`
- **Features**: Auto-save, Project Import/Export (.json)

## Key Features

1. **UltraSample Mode**: Instant recording to pads with auto-crop
2. **Social-Digging**: Import audio from web sources via backend
3. **16-Pad Grid**: Multi-touch support, low latency
4. **Step Sequencer**: 16-steps, parameter locks (velocity, pitch)

## File Structure

```
uss44/
├── backend/            # Node.js backend for audio extraction
├── src/
│   ├── components/     # UI Components
│   ├── stores/         # State management (Zustand)
│   ├── services/       # Business logic (Audio, DB)
│   ├── public/
│   │   └── worklets/   # AudioWorklet processors
│   └── types.ts
├── docs/               # Detailed documentation
└── .agent/             # AI Agent configs
```

## Operational Guidelines

### 1. Backend Development
- Changes to `backend/` require local testing with `npm run backend`
- Dependency: `yt-dlp` and `ffmpeg` must be installed on host

### 2. AudioWorklet
- DSP logic resides in `public/worklets/`
- Changes here usually do NOT require HMR; page reload needed

### 3. Shared Tools
- **Screenshots**: Run `npx acid-screenshot` in project root
- **Quality**: Run `npx acid-quality`

## Documentation References
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Detailed architecture guide
- [USER_MANUAL.md](./USER_MANUAL.md) - User facing documentation
- [TERMINOLOGY.md](./TERMINOLOGY.md) - Domain specific terms
