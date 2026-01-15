# 📖 USS44 User Manual

Welcome to the **USS44 Social Sampler**! This manual will guide you through the features and workflows of this powerful browser-based production tool.

---

## 🕹️ Interface Layout

### 1. Header (LCD & Status)
- **Logo (USS44)**: Click/Tap to toggle **UltraSample Mode**.
- **LCD Display**: Shows the current BPM, selected CHANNEL, and active PAD.
- **Visualizer**: Real-time spectral analysis of the master output.
- **Menu (Hamburger)**: Access Project Management (Save, Load, Export, Import) and Global Settings.

### 2. Mode Selector (Top Bar)
- **Dig Library**: Access the built-in sample library and network to find new sounds.
- **Perform / Edit**: Toggle the interaction mode for the pads.
  - **Perform**: Touching a pad triggers the sound.
  - **Edit**: Touching a pad selects it for parameter adjustment without triggering audio.
- **Step (Sequencer)**: Enter/Exit the 16-step pattern sequencer.
- **Play/Stop**: Start or stop the global sequencer clock. 
  - **Reset**: When stopped, the sequencer position and all waveform playheads reset to the beginning.

---

## 🎙️ Sampling & Sounds

### UltraSample Mode (Quick Record)
1. Toggle the **USS44 Logo** to enter UltraSample Mode (indicated by a pulsing Mic icon).
2. **Hold any pad** to record directly into it from your microphone.
3. Release the pad to stop recording. The sample is automatically trimmed and assigned.
4. Toggle the mode off to return to normal performance.

### Digging & Sample Packs (Library)
1. Tap **Dig Library** to see available sample sets.
2. **Library Icon**: Click the library icon next to the search bar to open the **Sample Pack Manager**.
   - **Add Pack**: Enter a Name and a JSON URL to add your own sample library.
   - **Switch Pack**: Use the **Switch** button to change the active library source.
   - **Import/Export**: Backup or share your entire sample pack list as a JSON file.
3. Preview sounds by clicking the mini-play icons.
   - **BPM Detection**: During preview, a pulsing BPM estimate will appear under the sample name.
4. Tap a sample name or **Load Pad** button to load it into the **currently selected pad**.

---

## 🎛️ Parameters (The PARAMS Panel)

When a pad is selected, you can manipulate its sound in real-time. Changes are applied instantly, even while the pad or sequencer is playing:

- **Chop Tab (Waveform)**:
  - Drag the **Start/End handles** to slice your sample.
  - Use the **Zoom** buttons or scroll to see details.
  - **BPM Loop Calculation**: In `LOOP` mode, the system automatically calculates the BPM between your Start and End markers.
  - **BPM SYNC**: Click the calculated BPM value to instantly sync the project's global tempo to that loop.
  - **Snap (Magnet Icon)**: Enable to automatically snap markers to the nearest **Zero-Crossing**, eliminating audible clicks at loop points.
- **Fx Tab (Knobs)**:
  - **Velocity**: Step intensity is visualized via border brightness (0-127).
  - **Pitch**: Change playback speed and tone (-24 to +24 semitones).
  - **Gain**: Adjust the volume level of the pad.
  - **Pan**: Move the sound in the stereo field.
  - **Cutoff / Res**: Control the 12dB/oct State Variable Filter.
  - **💡 Pro Tip**: **Double-click** or **Double-tap** any knob to instantly reset it to its default value!

---

## 🎼 Sequencing (Step Mode)

1. Select a pad you want to sequence.
2. Tap the **Step** button. The grid now represents 16 beats (1 bar).
3. Ensure you are in **Perform** mode to toggle steps ON/OFF.
4. Switch to **Edit** mode to select a specific step and adjust parameters:
   - **Velocity**: Controls volume and pad brightness (0-127).
   - **Pitch**: Per-step semitone offset.
   - **Length**: Controls the gate/loop duration per step (0.1 to 16.0). 
     * **Tip**: Setting Length to the max (**16.0**) allows loops to play infinitely without gating.
5. Press **Play** to hear your pattern loop. Multi-channel sequencing (A/B/C/D) is fully supported, allowing each bank to have its own independent sounds and sequences.

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
- **Audio Engine**: High-fidelity 44.1kHz internal sampling with jitter-free Worklet-side recording.
- **Context**: Must be served over `localhost` or `HTTPS` for microphone access.
