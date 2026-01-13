# 📖 USS44 User Manual

Welcome to the **USS44 Social Sampler**! This manual will guide you through the features and workflows of this powerful browser-based production tool.

---

## 🕹️ Interface Layout

### 1. Header (LCD & Status)
- **Logo (USS44)**: Click/Tap to toggle **UltraSample Mode**.
- **LCD Display**: Shows the current BPM, selected BANK, and active PAD.
- **Visualizer**: Real-time spectral analysis of the master output.
- **Menu (Hamburger)**: Access Project Management (Save, Load, Export, Import) and Global Settings.

### 2. Mode Selector (Top Bar)
- **Dig Library**: Access the built-in sample library and network to find new sounds.
- **Perform / Edit**: Toggle the interaction mode for the pads.
  - **Perform**: Touching a pad triggers the sound.
  - **Edit**: Touching a pad selects it for parameter adjustment without triggering audio.
- **Step (Sequencer)**: Enter/Exit the 16-step pattern sequencer.
- **Play/Stop**: Start or stop the global sequencer clock.

---

## 🎙️ Sampling & Sounds

### UltraSample Mode (Quick Record)
1. Toggle the **USS44 Logo** to enter UltraSample Mode (indicated by a pulsing Mic icon).
2. **Hold any pad** to record directly into it from your microphone.
3. Release the pad to stop recording. The sample is automatically trimmed and assigned.
4. Toggle the mode off to return to normal performance.

### Digging (Library)
1. Tap **Dig Library** to see available sample sets.
2. Preview sounds by clicking the mini-play icons.
3. Tap a sample name to load it into the **currently selected pad**.

---

## 🎛️ Parameters (The PARAMS Panel)

When a pad is selected, you can manipulate its sound in real-time. Changes are applied instantly, even while the pad or sequencer is playing:

- **Chop Tab (Waveform)**:
  - Drag the **Start/End handles** to slice your sample.
  - Use the **Zoom** buttons or scroll to see details.
- **Fx Tab (Knobs)**:
  - **Pitch**: Change playback speed and tone (0.1x to 4x).
  - **Gain**: Adjust the volume level of the pad.
  - **Pan**: Move the sound in the stereo field.
  - **Cutoff / Res**: Control the 12dB/oct State Variable Filter.

---

## 🎼 Sequencing (Step Mode)

1. Select a pad you want to sequence.
2. Tap the **Step** button. The grid now represents 16 beats (1 bar).
3. Ensure you are in **Perform** mode to toggle steps ON/OFF.
4. Switch to **Edit** mode to select a specific step and adjust its **Velocity** or **Pitch Offset** in the parameter panel.
5. Press **Play** to hear your pattern loop.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **1 ~ 4** | Trigger Pads 1 - 4 |
| **Q, W, E, R** | Trigger Pads 5 - 8 |
| **A, S, D, F** | Trigger Pads 9 - 12 |
| **Z, X, C, V** | Trigger Pads 13 - 16 |
| **Space** | Toggle Play / Stop |
| **Shift + Click** | (Logic dependent) Select without Triggering |

---

## 💾 Project Management

All your data is saved locally to your browser's **IndexedDB**. Even if you refresh, your last session will be restored.

- **Save Song**: Store your current project (including all recorded samples) to the local library.
- **Export All**: Download your entire project as a single `.json` file to share or backup.
- **Import All**: Drag and drop a `.json` project file to restore it.

---

## 🌐 System Requirements
- **Browser**: Chrome, Edge, or Safari (Web Audio API & AudioWorklet support required).
- **Context**: Must be served over `localhost` or `HTTPS` for microphone access.
