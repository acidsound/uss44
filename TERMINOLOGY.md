# 📗 USS44 Project Terminology

This document defines the key terms used in the UI, Logic, and Documentation of the USS44 project. Maintaining consistency in these terms is crucial as development complexity increases.

---

## 🏗️ Core Architecture

| Term | Scope | Definition |
| :--- | :--- | :--- |
| **Project** | Logic/UI | The entire state of the application, including 4 Banks, 64 Pads, and Global Settings (BPM). |
| **Bank** *(Internal: Channel)* | Logic/UI | A group of 16 pads. There are four banks: **A, B, C, and D**. Inspired by MPC's Bank concept. *Note: Internally codenamed `Channel` in stores/types for historical reasons; UI should display "Bank".* |
| **Pad** | Logic/UI | The fundamental unit of performance. Each pad holds one audio sample and its associated playback parameters. |
| **Voice Processor** | Logic | The `AudioWorklet` node that handles real-time audio rendering in a separate thread. |
| **Worklet State** | Logic | The internal representation of playback data (buffers, envelopes, play positions) within the Voice Processor. |

---

## 🎙️ Sampling & Audio Logic

| Term | Scope | Definition |
| :--- | :--- | :--- |
| **Sample** | Logic/UI | The raw audio data (`AudioBuffer`) associated with a pad. |
| **UltraSample Mode** | UI/Logic | A specialized mode for rapid recording from the microphone directly onto pads. |
| **Dig (Digging)** | UI/Logic | The process of discovering and importing audio from the local library or external web sources (Dig Network). *Derived from DJ/vinyl culture slang.* |
| **Automatic Cropping** | Logic | A feature that automatically removes silence from the start and end of a recorded sample. |
| **Zero-Crossing (Snap)** | Logic/UI | The point where an audio signal's amplitude is exactly zero. Snapping to this point prevents "clicks" during looping. |
| **Monophonic Playback (Choke)** | Logic | (Specific to GATE/LOOP) Ensuring only one instance of a pad is playing at a time. Re-triggering will "choke" (fade-out) the previous voice and start fresh. Similar to drum machine "Choke Groups" or "Mute Groups". |

---

## 🎛️ Parameters & Performance

| Term | Scope | Definition |
| :--- | :--- | :--- |
| **Params (Parameters)** | UI/Logic | **Top-level domain** for modifying pad settings. Contains *Chop* and *Control* sub-modes. |
| **Chop** | UI/Logic | **Sub-mode** of Parameters focused on waveform visualization, slicing (Start/End markers), and zooming. *Note: Technically closer to "Trim/Slice" but "Chop" is 4 characters, ideal for UI buttons.* |
| **Control (CTRL)** | UI/Logic | **Sub-mode** of Parameters focused on real-time manipulation via knobs (Pitch, Filter, Pan, Gain). Evokes MIDI CC (Control Change) concepts. |
| **Pitch** | Logic/UI | Playback speed/frequency adjustment. Range: 0.1x to 4.0x. |
| **Trigger Mode** | Logic/UI | Defines how the audio is played: |
| &nbsp;&nbsp; └ *ONESHOT* | | Plays from start to end once regardless of hold time. |
| &nbsp;&nbsp; └ *GATE* | | Plays only while the pad/key is held (Monophonic). |
| &nbsp;&nbsp; └ *LOOP* | | Loops between Start and End points while held (Monophonic). |
| **Envelope (AR)** | Logic/UI | The volume contour over time. *Currently implemented as an AR (Attack/Release) envelope.* ADSR may be added in future versions. |
| **BPM (Tempo)** | Logic/UI | Global clock measured in Beats Per Minute. Range: 20 to 300. |

---

## 🎼 Sequencing

| Term | Scope | Definition |
| :--- | :--- | :--- |
| **Step Mode** | UI | A view where the 16-pad grid represents time (16 steps = 1 bar) instead of direct pads. |
| **Pattern** | Logic | A data structure containing 16 steps for a specific pad-bank combination. |
| **Step** | Logic | An individual event in a pattern, containing attributes like *Active*, *Velocity*, *Pitch*, and *Length*. |
| **Step Cursor** *(or Playhead)* | UI/Logic | The visual indicator highlighting the current playing step in Sequence Mode. In waveform context, "Playhead" refers to the audio playback position. |

---

## 👯 Management & Utility

| Term | Scope | Definition |
| :--- | :--- | :--- |
| **Clone Pad** | Logic/UI | Operation to duplicate all settings and the sample reference from a source pad to a target pad. |
| **Sound Kit** | Logic/UI | A bundle of 16 pad configurations (parameters + audio data) that can be saved/loaded as a group. *Preferred over "Sample Kit" for consistency.* |
| **Project Song** | Logic/UI | A complete snapshot encompassing all 4 banks, sounds, patterns, and BPM. |
| **Factory Reset (Init All)** | UI/Logic | Restoring the application to its default state with the factory sound kit. |

---

## 📌 Internal Code Notes

> The following notes are for developers and are not user-facing.

- **`ChannelId`**: Internal type representing Bank identifier ('A', 'B', 'C', 'D'). Kept as "Channel" in code to avoid breaking database schema and saved project files. UI labels should display "Bank".
- **`currentChannel`**: State variable in `padStore.ts` representing the currently active bank.
- **`isPlayhead`**: Boolean variable in `PadGrid.tsx` used specifically for indicating the *Step Cursor* position in Sequence Mode.
