# 🔊 USS44 오디오 엔진 문서

> **목적**: Web Audio API 사용 패턴, AudioWorklet 구조, 오디오 처리 파이프라인 문서화
> 
> **작성일**: 2026-01-19
> 
> **기술 스택**: Web Audio API, AudioWorklet

---

## 🎵 오디오 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AudioContext                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐        │
│   │  Sample     │─────►│  Worklet    │─────►│  Master     │        │
│   │  Buffers    │      │  Processor  │      │  Analyser   │────────┼──► 🔈
│   └─────────────┘      └─────────────┘      └─────────────┘        │
│                              │                                       │
│                              ▼                                       │
│                        ┌─────────────┐                               │
│   ┌─────────────┐      │  Per-Pad    │                               │
│   │  Mic Input  │─────►│  Filters    │                               │
│   │  Stream     │      │  & Gains    │                               │
│   └─────────────┘      └─────────────┘                               │
│         │                                                            │
│         ▼                                                            │
│   ┌─────────────┐      ┌─────────────┐                               │
│   │  Mic        │─────►│  Recorder   │                               │
│   │  Analyser   │      │  Worklet    │                               │
│   └─────────────┘      └─────────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ 초기화 프로세스

### 1. AudioContext 생성

```typescript
// stores/audioStore.ts - initialize()
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
  sampleRate: 44100,
  latencyHint: 'interactive'
});
```

### 2. AudioWorklet 모듈 로드

```typescript
await audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
```

### 3. 노드 체인 구성

```typescript
// Main Processor Worklet
const workletNode = new AudioWorkletNode(audioContext, 'sample-processor');

// Master Analyser (시각화용)
const masterAnalyser = audioContext.createAnalyser();
masterAnalyser.fftSize = 2048;

// 연결
workletNode.connect(masterAnalyser);
masterAnalyser.connect(audioContext.destination);
```

---

## 🎹 패드 트리거 시스템

### 트리거 모드

| 모드 | 동작 | 동작 설명 |
|------|------|----------|
| `GATE` | 누르는 동안 재생 | 떼면 Release 시작 |
| `ONE_SHOT` | 한 번 전체 재생 | 떼어도 끝까지 재생 |
| `LOOP` | 누르는 동안 반복 | 떼면 Release 시작 |

### 트리거 플로우

```
┌─────────────────────────────────────────────────────────────┐
│ padStore.triggerPad(index, velocity, pitchMult, time, ch)   │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 패드 상태 업데이트  │  │  오디오 트리거    │  │   시각 피드백     │
│ - lastTriggerTime│  │  audioStore.    │  │   - LED 점등     │
│ - isHeld = true │  │  triggerPad()   │  │   - 글로우 효과   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   AudioWorklet      │
                    │   postMessage({     │
                    │     type: 'TRIGGER',│
                    │     padId, start,   │
                    │     end, pitch, ... │
                    │   })                │
                    └─────────────────────┘
```

### Worklet 메시지 포맷

```typescript
// 트리거 메시지
{
  type: 'TRIGGER_PAD',
  padId: string,           // 'A-0' ~ 'D-15'
  startTime: number,       // audioContext.currentTime
  sampleStart: number,     // 0 ~ 1 (샘플 시작점)
  sampleEnd: number,       // 0 ~ 1 (샘플 끝점)
  pitch: number,           // playbackRate
  volume: number,          // 0 ~ 2
  pan: number,             // -1 ~ 1
  cutoff: number,          // Hz
  resonance: number,       // Q
  velocity: number,        // 0 ~ 1
  triggerMode: string,     // 'GATE' | 'ONE_SHOT' | 'LOOP'
  envelope: {
    attack: number,
    decay: number,
    sustain: number,
    release: number
  }
}

// 정지 메시지
{
  type: 'STOP_PAD',
  padId: string,
  stopTime: number         // 정지 시작 시간 (Release 시작점)
}
```

---

## 🎚️ 실시간 파라미터 제어

### 파라미터 업데이트

```typescript
// audioStore.updatePadParams()
workletNode.port.postMessage({
  type: 'UPDATE_PARAMS',
  padId: 'A-0',
  cutoff: 5000,      // Hz
  resonance: 10,     // Q
  pitch: 1.5,        // playbackRate
  volume: 0.8,
  pan: -0.5,
  mute: false
});

// audioStore.updatePadStartEnd()
workletNode.port.postMessage({
  type: 'UPDATE_START_END',
  padId: 'A-0',
  start: 0.1,
  end: 0.9
});
```

### 파라미터 범위

| 파라미터 | 최소 | 최대 | 기본값 | 단위 |
|----------|------|------|--------|------|
| volume | 0 | 2 | 1 | 배율 |
| pitch | 0.1 | 4.0 | 1 | playbackRate |
| pan | -1 | 1 | 0 | L/R |
| cutoff | 20 | 20000 | 20000 | Hz |
| resonance | 0 | 20 | 0 | Q |
| start | 0 | 1 | 0 | 비율 |
| end | 0 | 1 | 1 | 비율 |

---

## 🎤 마이크 녹음 시스템

### UltraSample 모드 플로우

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  getUserMedia   │────►│  MediaStream    │────►│  createMeda...  │
│                 │     │  (mic input)    │     │  StreamSource   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
         ┌──────────────────────────────────────────────┤
         │                                              │
         ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│  Mic Analyser   │                           │  Recorder       │
│  (시각화용)      │                           │  Worklet        │
└─────────────────┘                           └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Float32Array   │
                                              │  chunks[]       │
                                              └─────────────────┘
```

### 녹음 API

```typescript
// 마이크 초기화
await audioStore.initMic();

// 녹음 시작
audioStore.startRecording();

// 녹음 종료 → AudioBuffer 반환
const buffer: AudioBuffer = await audioStore.stopRecording();
```

### Pre-roll 버퍼

녹음 시작 전 약간의 오디오를 미리 캡처하여 시작 부분 손실 방지:

```typescript
// 항상 최근 N개의 청크를 유지
const PRE_ROLL_CHUNKS = 10;  // 약 100ms

// 녹음 시작 시 pre-roll 청크를 포함
const allChunks = [...preRollChunks, ...recordedChunks];
```

---

## ⏱️ 시퀀서 타이밍

### 스케줄러 구조

```typescript
// App.tsx - scheduler
const scheduler = () => {
  const ctx = useAudioStore.getState().audioContext;
  const scheduleAhead = 0.1;  // 100ms 미리 스케줄링
  
  while (nextNoteTimeRef.current < ctx.currentTime + scheduleAhead) {
    scheduleNoteAtTime(currentStepRef.current, nextNoteTimeRef.current);
    advanceStep();
  }
  
  timerRef.current = requestAnimationFrame(scheduler);
};
```

### 타이밍 계산

```typescript
// 스텝 시간 계산
const secondsPerBeat = 60.0 / bpm;
const stepTime = 0.25 * secondsPerBeat;  // 1/16 노트

// 노트 길이 계산
const releaseTime = time + (stepData.length * stepTime);
```

### Look-ahead 스케줄링

```
                    현재 시간           scheduleAhead (100ms)
                        │                       │
     ────────────┼──────┼───────────────────────┼──────────►
                 │      │                       │        시간
                 │      └─── 이 범위 내의 노트 미리 스케줄링 ───┘
                 │
            실제 재생 위치
```

---

## 🔍 오디오 분석/시각화

### Master Analyser 설정

```typescript
const masterAnalyser = audioContext.createAnalyser();
masterAnalyser.fftSize = 2048;
masterAnalyser.smoothingTimeConstant = 0.8;
```

### 시각화 데이터 가져오기

```typescript
// Visualizer.tsx
const dataArray = new Uint8Array(analyser.frequencyBinCount);

// 파형 데이터
analyser.getByteTimeDomainData(dataArray);

// 주파수 데이터
analyser.getByteFrequencyData(dataArray);
```

### Mic Analyser

UltraSample 모드에서 실시간 마이크 입력 시각화:

```typescript
const micAnalyser = audioContext.createAnalyser();
micAnalyser.fftSize = 2048;
micSource.connect(micAnalyser);
```

---

## 📱 iOS Safari 특별 처리

### 오디오 컨텍스트 재개

iOS Safari는 백그라운드 복귀 시 오디오 컨텍스트가 `suspended` 상태가 됩니다.

```typescript
// App.tsx - handleVisibilityChange
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && initialized) {
      const { audioContext } = useAudioStore.getState();
      if (audioContext?.state === 'suspended' || audioContext?.state === 'interrupted') {
        setShowAudioResumePrompt(true);
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [initialized]);
```

### 사용자 제스처 요구

첫 번째 사용자 제스처 후에만 오디오 시작:

```typescript
// InitOverlay 클릭 시
const handleUserGesture = () => {
  startApp();
  window.removeEventListener('click', handleUserGesture);
};
window.addEventListener('click', handleUserGesture);
```

---

## ⚠️ 성능 고려사항

### 1. 샘플 버퍼 관리

```typescript
// 큰 샘플은 메모리 문제 야기 가능
// 권장: 10초 이하의 샘플

// 사용하지 않는 샘플 제거
audioStore.removeSampleFromWorklet(sampleId);
```

### 2. requestAnimationFrame 사용

```typescript
// ❌ setInterval 사용 금지 (정밀도 낮음)
// ✅ requestAnimationFrame 사용
timerRef.current = requestAnimationFrame(scheduler);
```

### 3. 메시지 빈도 제한

```typescript
// Worklet 메시지는 적절히 throttle
// 특히 파라미터 업데이트 시
```

### 4. 파형 처리 최적화 (향후 고려사항)

> ⚠️ **현재 상태**: 파형 처리(`generateWaveform`, `detectBPM`)는 메인 스레드에서 실행됩니다.

향후 큰 샘플 처리 시 UI 블로킹을 방지하려면 Web Worker로 오프로드 고려:

```typescript
// 현재 구현 (메인 스레드)
const waveform = generateWaveform(buffer);  // 블로킹

// 향후 개선안 (Web Worker)
const worker = new Worker('waveform-worker.js');
worker.postMessage({ buffer: audioData });
worker.onmessage = (e) => {
  const waveform = e.data.waveform;
};
```

---

## 🐛 일반적인 문제 해결

### 1. 오디오가 재생되지 않음

```javascript
// 체크할 것들:
1. audioContext.state === 'running' 확인
2. 사용자 제스처 후 초기화 확인
3. 샘플이 Worklet에 로드되었는지 확인
4. Mute/Solo 상태 확인
```

### 2. 타이밍 드리프트

```javascript
// 스케줄러가 충분히 자주 실행되지 않으면 드리프트 발생
// scheduleAhead 값 조정 (기본 0.1초)
```

### 3. 클릭/팝 노이즈

```javascript
// 원인: 급격한 볼륨 변화
// 해결: attack/release envelope 사용
// 최소 1-5ms의 페이드
```

### 4. iOS에서 소리 안 남

```javascript
// iOS는 무음 모드에서 오디오 차단
// 사용자에게 무음 모드 해제 안내 필요
```

---

## 🔧 디버깅 도구

### 1. 오디오 상태 확인

```javascript
// 브라우저 콘솔에서
const { audioContext, workletNode } = useAudioStore.getState();
console.log('AudioContext state:', audioContext?.state);
console.log('Sample rate:', audioContext?.sampleRate);
console.log('Current time:', audioContext?.currentTime);
```

### 2. Worklet 메시지 로깅

```javascript
// audio-worklet-processor.js 내부
this.port.onmessage = (e) => {
  console.log('[Worklet] Received:', e.data.type);
  // ...
};
```

### 3. Chrome DevTools

- **Performance 탭**: 오디오 처리 병목 확인
- **Memory 탭**: AudioBuffer 메모리 누수 확인

---

**문서 버전**: 1.0.0  
**최종 수정**: 2026-01-19
