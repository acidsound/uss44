# 🎙️ USS44: Social Media Sampler

**USS44** is a high-performance web-based sampler and sequencer designed for the modern era of rapid content creation. Inspired by the legendary workflows of classic samplers but reimagined for a browser-first experience, it allows you to capture, manipulate, and sequence sounds with unparalleled speed.

![USS44 Sampler](https://github.com/uss44/uss44/raw/main/public/preview.png) *(Placeholder: Replace with actual screenshot after deployment)*

## ✨ Key Features

- **🚀 UltraSample Mode**: Fast, intuitive recording directly to pads. One-touch sampling with automatic silence cropping.
- **🎹 16-Pad Performance Grid**: Low-latency triggering with full multi-touch support.
- **🎧 Social-Ready Digging**: Integrated 'Dig Network' to pull inspiration directly from web-based audio sources.
- **🎛️ Real-time DSP**:
  - **Pitch**: High-quality resampling from 0.1x to 4x.
  - **Filter**: TPT (Topology Preserving Transform) SVF Filter with Cutoff and Resonance control.
  - **Envelope**: Adjustable Attack and Release per pad.
  - **Pan & Gain**: Precise spatial and level control.
- **🎼 Step Sequencer**: 16-step patterns per pad with velocity, pitch shifting, and note length per step.
- **💾 Persistence & Library**:
  - Automatically saves your last session (BPM, Samples, Patterns) to IndexedDB.
  - Export and Import full projects as `.json`.
  - Save individual Sounds, Sequences, or full Songs to your local library.

## 🛠️ Technology Stack

- **Core**: React + TypeScript + Vite
- **Audio Engine**: Web Audio API with **AudioWorklets** for low-latency DSP.
- **State Management**: Zustand (with functional updates for thread safety).
- **Storage**: IndexedDB (via a robust custom `dbService`).
- **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/acidsound/uss44.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Deployment

This project is configured to deploy automatically to **GitHub Pages** via GitHub Actions.

- **Base URL**: `./` (configured in `vite.config.ts` for relative path compatibility).
- **CI/CD**: `.github/workflows/deploy.yml` handles the build and deployment on every push to `main`.

## 📄 License

MIT License. Designed with ❤️ by [acidsound](https://github.com/acidsound).
