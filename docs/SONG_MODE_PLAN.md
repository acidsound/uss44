ㅖ# Song Mode Implementation Plan

## 1. Overview
The **Song Mode** feature upgrades USS44 from a single-loop sequencer to a pattern-based song arranger. It introduces the concept of **Patterns** (independent 16-64 step sequences) and a **Song Playlist** (a sequential list of patterns).

## 2. Architecture Changes

### Data Structures (`types.ts`)
We will introduce strict types to manage the hierarchy:

```typescript
// A Pattern contains the sequence data for all tracks
export interface Pattern {
  id: string;        // e.g., 'ptn-0', 'ptn-1'
  name: string;      // Display name
  tracks: Record<string, StepData[]>; // Key: "Channel-PadIndex"
  length: number;    // Step count (16 or 64)
}

// A Song Item represents one entry in the playback queue
export interface SongItem {
  id: string;        // Unique ID for the playlist item
  patternId: string; // Reference to the Pattern
  repeatCount: number; // Number of times to loop (default: 1)
}

// Global Project Data Update
export interface ProjectData {
  // ... existing fields
  patterns: Record<string, Pattern>; // Library of all patterns
  song: SongItem[];                  // The playlist
  isSongMode: boolean;               // Toggle state
}
```

### State Management (`sequencerStore.ts`)
The `sequencerStore` will be refactored to separate the **Active Data** from the **Pattern Library**.

- **New State**:
  - `patternLibrary`: `Record<string, Pattern>`
  - `song`: `SongItem[]`
  - `isSongMode`: `boolean`
  - `activePatternId`: `string`
  - `songIndex`: `number` (Current position in song)

- **Modified Actions**:
  - `setPatterns` -> `updateActivePattern(id)`: Loads a pattern from library into the active render state.
  - `advanceSong()`: Triggered by the scheduler to move to the next pattern.

## 3. UI/UX Design
Follows `DESIGN_SYSTEM_GUIDE.md` (Retro aesthetic, Dark mode).

### Header Changes
- Add a **Song Mode Toggle** next to the Mode Selector.
- Add a **Pattern Selector** (A, B, C, D...) to the Sequence Panel.

### New Component: `SongEditor.tsx`
- A visual playlist editor replacing the PadGrid (or overlays it) when in Song Mode.
- **Features**:
  - List of Slots (Pattern A x 1, Pattern B x 2, etc.)
  - Drag and drop reordering (or simple Up/Down buttons).
  - Add/Remove pattern controls.
  - Visual 'Now Playing' indicator.

## 4. Implementation Tasks

### Phase 1: Foundation (Data & Store)
- [ ] **Task 1.1**: Update `types.ts` with `Pattern`, `SongItem`.
- [ ] **Task 1.2**: Refactor `sequencerStore.ts` to support `patternLibrary` and `song` state.
      - *Note*: Ensure backward compatibility by migrating existing `patterns` data to `Pattern A`.
- [ ] **Task 1.3**: Update `dbService.ts` to persist the new `patterns` and `song` structures.
      - *Migration*: `DB_VERSION` bump to 11. Convert old `SEQUENCES` store data to `Pattern A`.

### Phase 2: Logic (Playback Engine)
- [ ] **Task 2.1**: Update `App.tsx` Scheduler (`advanceStep`).
      - logic: `if (step == end && isSongMode) -> store.advanceSong()`.
- [ ] **Task 2.2**: Implement `advanceSong` in store.
      - Logic: Increment `songIndex`. If valid, `loadPattern(song[index].patternId)`. If end, loop song or stop.

### Phase 3: UI (Controls & Editor)
- [ ] **Task 3.1**: Update `SequencePanel` to include **Pattern Selector**.
      - A simple dropdown or radio group (A-H).
- [ ] **Task 3.2**: Create `SongEditor` modal or view.
      - Use `AppMode.SONG` to render it in `App.tsx`.
- [ ] **Task 3.3**: Add Song Mode toggle in Header.

### Phase 4: Validation
- [ ] **Task 4.1**: Verify smooth audio transition (no dropouts) when switching patterns.
- [ ] **Task 4.2**: Verify Persistence (Refresh page -> Song remains).

## 5. Risk Management
- **Breaking Changes**: Moving from single `activePattern` to `patternLibrary` is a potential breaking change for everything reading `state.patterns`.
  - *Mitigation*: Keep `state.patterns` as the "render buffer" but make it derived or explicitly updated from the library.
- **Audio Glitches**: Large state updates during playback (`loadPattern`) might cause frame drops.
  - *Mitigation*: Ensure `loadPattern` only updates React state (Zustand). The audio scheduler runs in a loop referencing refs where possible, or ensure update is lightweight.

## 6. Development Directives
- **No Git Push**: Code will be modified locally. Deployment is manual.
- **Code Quality**: Use `grep` checks for hardcoded colors/magic numbers.
