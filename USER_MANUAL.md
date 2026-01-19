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
   - **Switch Pack**: Use the **Refresh/Switch** icon button to quickly change the active library source.
   - **Favorites**: Click the **Star** icon next to any pack to add it to your favorites. Favorites stay at the top of the list for quick access. Use the Star filter next to search to see only your favorite packs.
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
- **CTRL Tab (Knobs)**:
  - **Pitch**: Change playback speed and tone (-24 to +24 semitones).
  - **Gain**: Adjust the volume level of the pad.
  - **Pan**: Move the sound in the stereo field.
  - **CUT OFF / Res**: Control the 12dB/oct State Variable Filter.
  - **💡 Pro Tip**: **Double-click** or **Double-tap** any knob to instantly reset it to its default value!
- **Pad Options Menu**:
  - Tap the **PAD** number in the header or use the **Shift + Click** (or context menu) to open pad options.
  - **Solo/Mute**: Isolate or silence the pad.
  - **Clone Pad**: Enter **Clone Mode**. While active, click any other pad to copy all settings and the sample link to that target. 
  - **Clear Pad**: Reset the pad to its default state.

---

## 🔊 Triggering & Playback

### Monophonic Behavior (Choke Group)
- For pads set to **GATE** or **LOOP** trigger modes, playback is strictly **monophonic**. 
- Re-triggering a pad will immediately "choke" (fade-out) the previous sound with a smooth 5ms crossfade, starting the new instance cleanly from the beginning. This behavior is similar to **Choke Groups** on hardware drum machines.

---

## 🎼 Sequencing (Step Mode)

1. Select a pad you want to sequence.
2. Tap the **Step** button. The grid now represents 16 steps (1 bar).
3. Ensure you are in **Perform** mode to toggle steps ON/OFF.
4. Switch to **Edit** mode to select a specific step and adjust parameters:
   - **Velocity**: Controls volume and pad brightness (0-127).
   - **Pitch**: Per-step semitone offset (-24 to +24).
   - **Length**: Controls the gate/loop duration per step (0.1 to 16.0). 
     * **Tip**: Setting Length to the max (**16.0**) allows loops to play infinitely without gating.
5. Press **Play** to hear your pattern loop. Multi-channel sequencing (A/B/C/D) is fully supported.

### Real-time Step Recording (MPC Style)
You can record your performance directly into the sequencer in real-time:
1. **Enable Record Mode**: **Long-press** the **Play** button until it turns red and shows a record icon.
2. **Perform**: While the sequencer is playing, hit any pad in **Perform** mode. Your hits will be automatically recorded into the active step of the sequencer.
3. **Disable**: Long-press the Play button again (or stop playback) to exit recording mode.
   * *Note: This allows you to quickly build patterns by "playing" them rather than manual step entry.*

### Minimalist Step Visualization
To maximize clarity on mobile screens, active steps display parameters visually instead of text:
- **Length Bar (Bottom)**: A thin green bar at the bottom of each step shows relative length.
- **Pitch Bar (Right Side)**: A thin vertical bar on the right indicates pitch offset.
  - **Cyan (Up)**: Positive pitch shift.
  - **Orange (Down)**: Negative pitch shift.
- The step number is subtly shown in the top-right corner at reduced opacity.

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

### 1. Granular Export & Import
Export your work at different levels of complexity:
- **Sequence**: Small files containing only the 16-step patterns. Great for sharing rhythms.
- **Sound Kit**: Contains the 16 pad settings AND all associated audio sample data. Perfect for sharing your "Sound" without the sequence data.
- **Project Song**: The full snapshot. Includes all sounds, samples, patterns, and BPM. This is the complete work.

### 2. File Operations
- **Save to Library**: Store the current item (Song, Kit, or Sequence) into your browser's local database.
- **Export to JSON**: Download the current active state directly as a file.
- **Import from JSON**: Drag or select any USS44 `.json` file. The system automatically detects if it's a Song, Kit, or Sequence and loads it appropriately.

---

## 🛠️ Global Tools
- **BPM Control**: Found in the LCD. Tap or drag to adjust.
  - **HALF (🐌)** / **DOUBLE (🐰)**: Quickly halve or double the current BPM.
  - **Precision TAP**: Tap the button to set tempo. Uses high-precision timing with visual feedback.
- **Init All (Factory Reset)**: Found in the Settings menu. This will clear all active workspace data and restore the **Factory Default Sound Kit**, giving you a clean slate with classic sounds.
- **Individual Clear Tools**: Next to the Export/Import icons in the Settings menu, you can find **Trash (Clear)** buttons for each section:
  - **Sequence Clear**: Wipes all patterns while keeping your BPM and Step Length settings.
  - **Sound Kit Clear**: Resets all pads and clears loaded samples.
  - **Project Song Clear**: Resets both sound and sequence for a completely empty project.
- **Render Audio (Mixdown)**: Found in the Settings menu. This high-performance feature renders your entire pattern (all channels/pads) into a single high-quality WAV file using an `OfflineAudioContext`.
  - **Preview**: Listen to the mixed-down result and see its waveform.
  - **Download**: Save the result as a `.wav` file to your device.
  - **Load to Pad**: Instantly assign the rendered audio to your currently selected pad for further resampling.
- **Stop Reset**: When the sequencer is stopped, all waveform playheads reset to their start positions.

---

## 🌐 System Requirements
- **Browser**: Chrome, Edge, or Safari (Web Audio API & AudioWorklet support required).
- **Audio Engine**: High-fidelity 44.1kHz internal sampling with jitter-free Worklet-side recording.
- **Context**: Must be served over `localhost` or `HTTPS` for microphone access.
