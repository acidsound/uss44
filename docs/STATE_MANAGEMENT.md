# 🗄️ USS44 상태 관리 문서

> **목적**: Zustand 스토어 구조, 상태 흐름, 스토어 간 상호작용 문서화
> 
> **작성일**: 2026-01-19
> 
> **상태 관리 라이브러리**: Zustand 4.5.0

---

## 📊 스토어 개요

USS44는 3개의 Zustand 스토어를 사용합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│                    (스케줄러, UI 상태)                        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  padStore   │◄────►│sequencerStore│◄────►│ audioStore  │
│  (패드/샘플) │      │  (시퀀서)    │      │  (오디오)   │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │   dbService     │
                    │   (IndexedDB)   │
                    └─────────────────┘
```

---

## 🎹 padStore

패드, 샘플, 채널 관련 상태를 관리합니다.

### 위치
```
stores/padStore.ts
```

### 상태 (State)

```typescript
interface PadState {
  // 핵심 상태
  pads: Record<string, Pad>;              // 패드 데이터 (키: "A-0" ~ "D-15")
  currentChannel: ChannelId;              // 현재 채널 ('A' | 'B' | 'C' | 'D')
  selectedPadId: string;                  // 선택된 패드 ID ('pad-0' ~ 'pad-15')
  isHydrating: boolean;                   // 데이터 로딩 중 여부
  
  // 샘플 관련
  sampleLibrary: SampleMetadata[];        // 샘플 라이브러리 목록
  samples: Record<string, {               // 샘플 메타데이터
    name: string;
    waveform: number[];
  }>;
  samplePacks: SamplePack[];              // 샘플 팩 목록
  currentSamplePackId: string;            // 현재 샘플 팩 ID
  
  // Clone 모드
  isCloneMode: boolean;
  sourcePadId: string | null;
}
```

### Pad 타입 상세

```typescript
interface Pad {
  id: string;              // 'pad-0' ~ 'pad-15'
  channelId: ChannelId;    // 'A' | 'B' | 'C' | 'D'
  sampleId: string | null; // 연결된 샘플 ID
  
  // 파라미터
  volume: number;          // 0 ~ 2
  pitch: number;           // 0.1 ~ 4.0 (playbackRate)
  pan: number;             // -1 ~ 1
  cutoff: number;          // Hz (20 ~ 20000)
  resonance: number;       // 0 ~ 20 (Q)
  start: number;           // 0 ~ 1 (샘플 시작점)
  end: number;             // 0 ~ 1 (샘플 끝점)
  envelope: Envelope;
  triggerMode: TriggerMode; // 'GATE' | 'ONE_SHOT' | 'LOOP'
  
  // 뷰 상태
  viewStart: number;       // 파형 뷰 시작점
  viewEnd: number;         // 파형 뷰 끝점
  
  // 런타임 상태
  buffer?: AudioBuffer;
  lastTriggerTime?: number;
  lastTriggerDuration?: number;
  lastStopTime?: number;
  isHeld?: boolean;
  mute?: boolean;
  solo?: boolean;
}
```

### 액션 (Actions)

| 액션 | 설명 | 사용처 |
|------|------|--------|
| `initPads()` | 패드 초기화, DB에서 복원 | App 초기화 |
| `setChannel(channel)` | 채널 전환 | 채널 버튼 |
| `selectPad(index)` | 패드 선택 | PadGrid 터치 |
| `updatePad(index, updates)` | 패드 파라미터 업데이트 | Knob, WaveformEditor |
| `triggerPad(...)` | 패드 재생 시작 | 터치, 시퀀서 |
| `stopPad(index, time?, channel?)` | 패드 재생 중지 | 터치 해제, 시퀀서 |
| `loadSample(index, url, name)` | 샘플 로드 | SampleBrowser |
| `clearPad(index)` | 패드 초기화 | PadMenu |
| `toggleMute(index)` | 뮤트 토글 | PadMenu |
| `toggleSolo(index)` | 솔로 토글 | PadMenu |
| `setCloneMode(sourcePadId)` | 클론 모드 진입 | PadMenu |
| `executeClone(targetIndex)` | 클론 실행 | PadGrid |
| `loadSamplePack(packId)` | 샘플 팩 로드 | SamplePackManager |
| `toggleFavoritePack(packId)` | 샘플 팩 즐겨찾기 토글 | SamplePackManager |

### 상태 흐름 예시

```
[사용자 터치]
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ PadGrid.handlePadStart(idx)                                   │
│   └─► padStore.selectPad(idx)                                 │
│   └─► padStore.triggerPad(idx, velocity, pitch, time)        │
│          │                                                    │
│          ├─► 패드 상태 업데이트 (lastTriggerTime, isHeld)     │
│          └─► audioStore.triggerPad(data) ──► AudioWorklet     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎵 sequencerStore

시퀀서, BPM, 패턴 관련 상태를 관리합니다.

### 위치
```
stores/sequencerStore.ts
```

### 상태 (State)

```typescript
interface SequencerState {
  bpm: number;                              // 20 ~ 300
  isPlaying: boolean;                       // 재생 중 여부
  currentStep: number;                      // 현재 스텝 (-1 ~ stepCount-1)
  selectedStepIndex: number;                // 편집 중인 스텝
  stepCount: number;                        // 16 또는 64
  patterns: Record<string, StepData[]>;     // 패턴 (키: "A-0" ~ "D-15")
  lastStepSettings: Omit<StepData, 'active'>; // 마지막 스텝 설정 (복사용)
}
```

### StepData 타입

```typescript
interface StepData {
  active: boolean;    // 스텝 활성화 여부
  velocity: number;   // 0 ~ 127
  pitch: number;      // -24 ~ +24 (반음 단위)
  length: number;     // 0.1 ~ 16.0 (스텝 단위)
}
```

### 액션 (Actions)

| 액션 | 설명 | 사용처 |
|------|------|--------|
| `initSequencer()` | 시퀀서 초기화, DB 복원 | App 초기화 |
| `resetSequencer()` | 시퀀서 리셋 | Factory Reset |
| `setBpm(bpm)` | BPM 설정 | BpmModal |
| `setStepCount(count)` | 스텝 수 설정 (16/64) | SettingsMenu |
| `togglePlay()` | 재생/정지 | Transport 버튼 |
| `setStep(step)` | 현재 스텝 설정 | 스케줄러 |
| `toggleStep(channel, pad, step)` | 스텝 토글 | PadGrid (시퀀스 모드) |
| `updateStepData(...)` | 스텝 데이터 업데이트 | SequencePanel |
| `setPatterns(patterns)` | 패턴 일괄 설정 | 프로젝트 로드 |

### 패턴 키 포맷

```
패턴 키 = "${channel}-${padIndex}"

예시:
- "A-0": 채널 A, 패드 0
- "B-15": 채널 B, 패드 15
- "D-7": 채널 D, 패드 7
```

### 시퀀서 타이밍 계산

```typescript
// BPM에서 스텝 시간 계산
const secondsPerBeat = 60.0 / bpm;
const stepTime = 0.25 * secondsPerBeat;  // 1/16 노트

// 예: 120 BPM
// secondsPerBeat = 0.5초
// stepTime = 0.125초 (125ms)
```

---

## 🔊 audioStore

오디오 컨텍스트, Worklet, 마이크 관련 상태를 관리합니다.

### 위치
```
stores/audioStore.ts
```

### 상태 (State)

```typescript
interface AudioState {
  // 코어 오디오
  audioContext: AudioContext | null;
  workletNode: AudioWorkletNode | null;
  initialized: boolean;
  isInitializing: boolean;
  
  // 마이크/레코딩
  micStream: MediaStream | null;
  micSource: MediaStreamAudioSourceNode | null;
  micAnalyser: AnalyserNode | null;
  isRecording: boolean;
  recordedChunks: Float32Array[];
  preRollChunks: Float32Array[];
  
  // 분석
  masterAnalyser: AnalyserNode | null;
  recorderNode: AudioWorkletNode | null;
}
```

### 액션 (Actions)

| 액션 | 설명 | 사용처 |
|------|------|--------|
| `initialize(ctx?)` | 오디오 시스템 초기화 | App 시작 |
| `resume()` | 오디오 컨텍스트 재개 | iOS 백그라운드 복귀 |
| `loadSampleToWorklet(id, buffer)` | 샘플 로드 | padStore.loadSample |
| `removeSampleFromWorklet(id)` | 샘플 제거 | padStore.clearPad |
| `triggerPad(data)` | 패드 트리거 | padStore.triggerPad |
| `stopPad(padId, time?)` | 패드 정지 | padStore.stopPad |
| `updatePadStartEnd(...)` | 시작/끝점 업데이트 | WaveformEditor |
| `updatePadParams(...)` | 파라미터 업데이트 | Knob 조작 |
| `stopAll()` | 모든 소리 정지 | 재생 정지 시 |
| `initMic()` | 마이크 초기화 | UltraSample 모드 진입 |
| `closeMic()` | 마이크 종료 | UltraSample 모드 종료 |
| `startRecording()` | 녹음 시작 | UltraSample, RecordingModal |
| `stopRecording()` | 녹음 종료 | UltraSample, RecordingModal |

### AudioWorklet 통신

```typescript
// Worklet으로 메시지 전송
workletNode.port.postMessage({
  type: 'TRIGGER_PAD',
  padId: 'A-0',
  startTime: audioContext.currentTime,
  // ... 기타 파라미터
});

// Worklet에서 메시지 수신
workletNode.port.onmessage = (e) => {
  if (e.data.type === 'RECORDING_DATA') {
    // 녹음 데이터 처리
  }
};
```

---

## 🔄 스토어 간 상호작용

### 1. 패드 트리거 플로우

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│    padStore    │────►│   audioStore   │────►│  AudioWorklet  │
│                │     │                │     │                │
│ triggerPad()   │     │ triggerPad()   │     │ play sample    │
└────────────────┘     └────────────────┘     └────────────────┘
```

### 2. 시퀀서 재생 플로우

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│    App.tsx     │────►│sequencerStore  │     │   padStore     │
│  (스케줄러)     │     │                │     │                │
│                │     │ patterns[key]  │────►│ triggerPad()  │
└────────────────┘     └────────────────┘     └────────────────┘
                                                     │
                                                     ▼
                                              ┌────────────────┐
                                              │  audioStore    │
                                              │ triggerPad()   │
                                              └────────────────┘
```

### 3. 샘플 로드 플로우

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│ SampleBrowser  │────►│   padStore     │────►│  audioStore    │
│                │     │                │     │                │
│ select sample  │     │ loadSample()   │     │loadSampleTo... │
└────────────────┘     └────────────────┘     └────────────────┘
                              │
                              ▼
                       ┌────────────────┐
                       │   dbService    │
                       │  saveSample()  │
                       └────────────────┘
```

---

## 💾 데이터 영속성 (Persistence)

### IndexedDB 스키마 (via dbService)

| 스토어 | 키 | 값 |
|--------|-----|-----|
| `samples` | sampleId | `{ id, name, data, waveform }` |
| `pads` | padId | Pad 객체 |
| `sequences` | patternKey | StepData[] |
| `metadata` | key | 다양한 메타데이터 |

### 자동 저장 시점

| 이벤트 | 저장 대상 |
|--------|----------|
| 패드 파라미터 변경 | `pads` 스토어 |
| 스텝 토글/수정 | `sequences` 스토어 |
| BPM 변경 | `metadata` |
| 샘플 로드/녹음 | `samples` 스토어 |

---

## ⚠️ 주의사항

### 1. 직접 상태 변경 금지

```typescript
// ❌ 금지
const pads = usePadStore.getState().pads;
pads['A-0'].volume = 0.5;  // 직접 변경

// ✅ 올바른 방법
usePadStore.getState().updatePad(0, { volume: 0.5 });
```

### 2. 스토어 간 순환 참조 주의

```typescript
// ❌ 주의: padStore에서 audioStore 호출
// audioStore에서 padStore 호출하면 순환 참조 위험

// ✅ 권장: 상위 컴포넌트에서 조율
```

### 3. 비동기 작업 처리

```typescript
// ✅ 올바른 비동기 처리
const loadSample = async (index, url, name) => {
  try {
    const buffer = await fetchAndDecode(url);
    // 상태 업데이트
    set(state => ({ ... }));
    // DB 저장
    await dbService.saveSample(...);
  } catch (error) {
    console.error('Failed to load sample', error);
  }
};
```

---

## 🧪 디버깅 팁

### 상태 확인

```javascript
// 브라우저 콘솔에서
usePadStore.getState()
useSequencerStore.getState()
useAudioStore.getState()
```

### 상태 변경 구독

```javascript
// 변경 로깅
usePadStore.subscribe(
  state => console.log('padStore changed:', state)
);
```

---

**문서 버전**: 1.0.0  
**최종 수정**: 2026-01-19
