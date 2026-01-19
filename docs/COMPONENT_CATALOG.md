# 📦 USS44 컴포넌트 카탈로그

> **목적**: 재사용 가능한 컴포넌트의 사용법, Props, 변형(Variants) 문서화
> 
> **작성일**: 2026-01-19
> 
> **위치**: `components/` 디렉토리

---

## 📋 컴포넌트 목록

| 컴포넌트 | 파일 | 용도 |
|----------|------|------|
| [PadGrid](#padgrid) | `PadGrid.tsx` | 4x4 또는 8x8 패드 그리드 |
| [Knob](#knob) | `Knob.tsx` | 회전식 파라미터 조절 노브 |
| [ParametersPanel](#parameterspanel) | `ParametersPanel.tsx` | 패드 파라미터 편집 패널 |
| [WaveformEditor](#waveformeditor) | `WaveformEditor.tsx` | 파형 편집 및 시작/끝점 설정 |
| [BpmModal](#bpmmodal) | `BpmModal.tsx` | BPM 설정 모달 |
| [SettingsMenu](#settingsmenu) | `SettingsMenu.tsx` | 시스템 설정 메뉴 |
| [SampleBrowser](#samplebrowser) | `SampleBrowser.tsx` | 샘플 라이브러리 탐색 |
| [PadMenu](#padmenu) | `PadMenu.tsx` | 패드 컨텍스트 메뉴 |
| [RecordingModal](#recordingmodal) | `RecordingModal.tsx` | 프로 레코딩 모달 |
| [SequencePanel](#sequencepanel) | `SequencePanel.tsx` | 시퀀스 모드 편집 패널 |
| [SamplePackManager](#samplepackmanager) | `SamplePackManager.tsx` | 샘플 팩 라이브러리 관리 |
| [Visualizer](#visualizer) | `Visualizer.tsx` | 오디오 시각화 |
| [LoadingOverlay](#loadingoverlay) | `LoadingOverlay.tsx` | 로딩 오버레이 |
| [InitOverlay](#initoverlay) | `InitOverlay.tsx` | 앱 초기화 오버레이 |
| [RenderModal](#rendermodal) | `RenderModal.tsx` | 프로젝트 믹스다운 및 결과물 관리 |
| [WaveformCanvas](#waveformcanvas) | `WaveformCanvas.tsx` | 공용 캔버스 기반 파형 렌더러 |

---

## 🔲 PadGrid

4x4 (16 패드) 또는 8x8 (64 스텝) 그리드를 렌더링합니다.

### 위치
```
components/PadGrid.tsx
```

### Props

```typescript
interface PadGridProps {
  appMode?: AppMode;              // 'PERFORM' | 'SEQUENCE' | 'SAMPLE' | 'EDIT'
  isEditMode?: boolean;           // 편집 모드 여부
  isUltraSampleMode?: boolean;    // UltraSample 녹음 모드
  onUltraRecordStart?: (index: number) => void;  // 녹음 시작 콜백
  onUltraRecordStop?: (index: number) => void;   // 녹음 종료 콜백
}
```

### 사용 예시

```tsx
// 기본 Perform 모드
<PadGrid appMode={AppMode.PERFORM} />

// Sequence 모드
<PadGrid appMode={AppMode.SEQUENCE} isEditMode={false} />

// UltraSample 모드
<PadGrid
  isUltraSampleMode={true}
  onUltraRecordStart={(idx) => startRecording(idx)}
  onUltraRecordStop={(idx) => stopRecording(idx)}
/>
```

### 동작 모드

| 모드 | 그리드 크기 | 터치 동작 |
|------|-------------|-----------|
| PERFORM | 4x4 (16) | 패드 선택 + 트리거 |
| SEQUENCE | stepCount (16/64) | 스텝 토글 |
| EDIT | 4x4 (16) | 패드 선택만 (트리거 없음) |
| UltraSample | 4x4 (16) | 누르면 녹음 시작, 떼면 종료 |

### 내부 상태
- `activeInteractionsRef`: 멀티터치 추적
- `isTouchActiveRef`: 터치/마우스 구분

---

## 🎛️ Knob

드래그로 값을 조절하는 회전식 노브 컴포넌트입니다.

### 위치
```
components/Knob.tsx
```

### Props

```typescript
interface KnobProps {
  label: string;           // 노브 레이블 (예: "PITCH")
  value: number;           // 현재 값
  min: number;             // 최소값
  max: number;             // 최대값
  defaultValue?: number;   // 더블클릭 시 리셋 값
  onChange: (val: number) => void;  // 값 변경 콜백
  color?: string;          // 테두리 색상 (기본: 'border-retro-accent')
  precision?: number;      // 표시 소수점 자릿수 (기본: 2)
}
```

### 사용 예시

```tsx
// 기본 사용
<Knob
  label="Pitch"
  min={0.1}
  max={4.0}
  value={1.0}
  defaultValue={1.0}
  onChange={(v) => updatePad({ pitch: v })}
/>

// Pan 컨트롤 (-1 ~ 1)
<Knob
  label="Pan"
  min={-1}
  max={1}
  value={0}
  defaultValue={0}
  onChange={(v) => updatePad({ pan: v })}
/>

// Cutoff (kHz 표시)
<Knob
  label="CUT OFF"
  min={0.02}
  max={20.0}
  value={cutoffKHz}
  defaultValue={20.0}
  onChange={(v) => updatePad({ cutoff: v * 1000 })}
/>
```

### 인터랙션

| 제스처 | 동작 |
|--------|------|
| 위로 드래그 | 값 증가 |
| 아래로 드래그 | 값 감소 |
| 더블클릭 | defaultValue로 리셋 |

### 스타일링
- 크기: `w-14 h-14` (56px)
- 드래그 중: `border-retro-accent ring-4`
- 값 표시: `text-retro-accent glow-red`

---

## 🎚️ ParametersPanel

선택된 패드의 파라미터를 편집하는 패널입니다.

### 위치
```
components/ParametersPanel.tsx
```

### Props

```typescript
interface ParametersPanelProps {
  isLandscape: boolean;           // 가로 모드 여부
  isUltraSampleMode?: boolean;    // UltraSample 모드 여부
}
```

### 사용 예시

```tsx
<ParametersPanel isLandscape={isLandscape} isUltraSampleMode={false} />
```

### 서브 모드 (Portrait)

| 모드 | 표시 내용 |
|------|----------|
| CHOP | WaveformEditor |
| CONTROL | Knob 그리드 (Pitch, Gain, Pan, Cutoff, Res) |

### 레이아웃 차이

- **Portrait**: 탭으로 CHOP/CONTROL 전환
- **Landscape**: 상단 WaveformEditor + 하단 Knob 그리드 동시 표시

---

## 📊 WaveformEditor

오디오 파형을 표시하고 시작/끝점을 편집하는 컴포넌트입니다.

### 위치
```
components/WaveformEditor.tsx
```

### Props

```typescript
interface WaveformEditorProps {
  isUltraSampleMode?: boolean;  // 라이브 마이크 모니터링 모드
}
```

### 기능

| 기능 | 설명 |
|------|------|
| 시작/끝 마커 드래그 | 샘플 재생 범위 설정 |
| 스크롤 드래그 | 뷰포트 이동 |
| 핀치/드래그 | 줌 인/아웃 |
| 시간/샘플 룰러 | 상단 룰러 클릭으로 TIME/SAMPLES 모드 전환 |
| 더블탭 크롭 | 더블탭 후 드래그로 범위 선택 |
| Auto Crop | 무음 부분 자동 트림 |
| Zero-Crossing Snap | 가장 가까운 0점에 스냅 |

### 트리거 모드 전환

```tsx
// 툴바 내 트리거 모드 버튼
<button onClick={() => setTriggerMode('GATE')}>Gate</button>
<button onClick={() => setTriggerMode('ONE_SHOT')}>Oneshot</button>
<button onClick={() => setTriggerMode('LOOP')}>Loop</button>
```

### 색상 코드

| 요소 | 색상 |
|------|------|
| START 마커 | `#00ffcc` (시안) |
| END 마커 | `#ffdd00` (노랑) |
| 재생 헤드 | `#ffffff` (흰색) |
| 파형 | `#ff3c6a` (핑크) |

---

## ⏱️ BpmModal

BPM을 설정하는 모달 다이얼로그입니다.

### 위치
```
components/BpmModal.tsx
```

### Props

```typescript
interface BpmModalProps {
  onClose: () => void;  // 닫기 콜백
}
```

### 사용 예시

```tsx
{showBpmModal && <BpmModal onClose={() => setShowBpmModal(false)} />}
```

### 기능

| 기능 | 설명 |
|------|------|
| 다이얼 드래그 | BPM 연속 조절 (20-300) |
| TAP 버튼 | 탭 템포 감지 |
| HALF | 현재 BPM의 절반 |
| DOUBLE | 현재 BPM의 두 배 |

---

## ⚙️ SettingsMenu

시스템 설정 및 프로젝트 관리 메뉴입니다.

### 위치
```
components/SettingsMenu.tsx
```

### Props

```typescript
interface SettingsMenuProps {
  onClose: () => void;  // 닫기 콜백
}
```

### 제공 기능

| 기능 | 설명 |
|------|------|
| Init All | 공장 초기화 |
| Step Length | 16 또는 64 스텝 선택 |
| Sequence | 시퀀스 저장/불러오기/내보내기 |
| Sound Kit | 사운드 저장/불러오기/내보내기 |
| Project Song | 프로젝트 저장/불러오기/내보내기 |
| Import from JSON | JSON 파일 가져오기 |

---

## 🎵 SampleBrowser

샘플 라이브러리를 탐색하고 패드에 로드하는 컴포넌트입니다.

### 위치
```
components/SampleBrowser.tsx
```

### Props

```typescript
interface SampleBrowserProps {
  onClose: () => void;    // 닫기 콜백
  isLandscape: boolean;   // 가로 모드 여부
}
```

### 탭

| 탭 | 내용 |
|-----|------|
| LIBRARY | 로컬 샘플 라이브러리 |
| DIG | 외부 네트워크에서 샘플 검색 |

### 하위 컴포넌트

- `WaveformThumbnail`: 샘플 미리보기 파형
- `SampleItem`: 개별 샘플 아이템

---

## 📚 SamplePackManager

샘플 팩(JSON) 목록을 관리하고 즐겨찾기를 설정합니다.

### 위치
```
components/SamplePackManager.tsx
```

### Props

```typescript
interface SamplePackManagerProps {
  onClose: () => void;
}
```

### 주요 기능

| 기능 | 설명 |
|------|------|
| 팩 전환 | `RefreshCw` 아이콘으로 활성 팩 변경 |
| 즐겨찾기 | `Star` 아이콘으로 팩 고정 및 필터링 |
| 검색/필터 | 이름/URL 검색 및 즐겨찾기 필터 제공 |
| CRUD | 팩 추가, 수정, 삭제 기능 |
| 복구 | 팩 리스트 JSON 내보내기/가져오기 |

---

## 📋 PadMenu

패드에 대한 컨텍스트 메뉴입니다.

### 위치
```
components/PadMenu.tsx
```

### Props

```typescript
interface PadMenuProps {
  padIndex: number;               // 대상 패드 인덱스
  isOpen: boolean;                // 메뉴 열림 상태
  onClose: () => void;            // 닫기 콜백
  anchorRect?: DOMRect;           // 위치 기준 요소
}
```

### 메뉴 항목

- Mute
- Solo  
- Clone
- Clear

---

## 🎤 RecordingModal

프로 레코딩을 위한 전체 화면 모달입니다.

### 위치
```
components/RecordingModal.tsx
```

### Props

```typescript
interface RecordingModalProps {
  onClose: () => void;
  onSave: (buffer: AudioBuffer, name: string) => void;
}
```

### 기능

- 마이크 입력 시각화
- 녹음 시작/정지
- 녹음된 샘플 미리듣기
- 이름 설정 후 저장

---

## 🎹 SequencePanel

시퀀스 모드에서 스텝 파라미터를 편집하는 패널입니다.

### 위치
```
components/SequencePanel.tsx
```

### 편집 가능 파라미터

| 파라미터 | 범위 | 설명 |
|----------|------|------|
| Velocity | 0-127 | 타격 강도 |
| Pitch | -24 ~ +24 | 반음 단위 피치 |
| Length | 0.1 ~ 16.0 | 노트 길이 (스텝 단위) |

---

## 📈 Visualizer

마스터 오디오 출력을 시각화하는 컴포넌트입니다.

### 위치
```
components/Visualizer.tsx
```

### 사용 위치

- 헤더 LCD 영역 (Portrait)
- 사이드바 (Landscape)

---

## ⏳ LoadingOverlay

데이터 로딩 중 표시하는 오버레이입니다.

### 위치
```
components/LoadingOverlay.tsx
```

### 사용 조건

```tsx
{isHydrating && <LoadingOverlay />}
```

---

## 📤 RenderModal

전체 프로젝트 시퀀스를 하나의 WAV 오디오 파일로 믹스다운(Render)하는 모달입니다.

### 위치
```
components/RenderModal.tsx
```

### 기능

| 기능 | 설명 |
|------|------|
| Offline Render | `OfflineAudioContext`를 이용한 고속 믹스다운 |
| Waveform Preview | 렌더링된 결과물의 전체 파형 시각화 |
| Playback | 파형 위에서 재생 및 실시간 플레이헤드(재생 바) 표시 |
| Ruler | 렌더링된 오디오 길이에 맞춘 시간 룰러 표시 |
| Export | WAV 파일 다운로드 또는 특정 패드에 즉시 로드 |

---

## 📊 WaveformCanvas

파형 시각화와 플레이헤드 표시를 담당하는 고성능 공용 컴포넌트입니다.

### 위치
```
components/WaveformCanvas.tsx
```

### Props

```typescript
interface WaveformCanvasProps {
    waveform: number[];           // 파형 데이터 (0~1)
    buffer?: AudioBuffer | null;  // (옵션) 고해상도 렌더링용 버퍼
    viewStart?: number;           // 뷰 시작 (0~1)
    viewEnd?: number;             // 뷰 끝 (0~1)
    playheadPosition?: number | null; // 재생 위치 (0~1)
    showRuler?: boolean;          // 시간 룰러 표시 여부
    duration?: number;            // 룰러 계산용 총 길이
    color?: string;               // 파형 색상
}
```

---

## 🚀 InitOverlay

앱 초기화 (첫 터치) 대기 화면입니다.

### 위치
```
components/InitOverlay.tsx
```

### 사용 조건

```tsx
{!initialized && <InitOverlay />}
```

---

## 🎨 스타일링 공통 규칙

모든 컴포넌트는 `DESIGN_SYSTEM_GUIDE.md`의 규칙을 따릅니다.

### 필수 사항

1. **색상**: `retro-*`, `channel-*` 팔레트만 사용
2. **폰트**: `font-sans` (Inter) 또는 `font-mono` (JetBrains Mono)
3. **레이블**: `text-[10px] font-extrabold uppercase tracking-widest`
4. **전환**: `transition-all` 또는 `transition-colors`
5. **터치 피드백**: `active:scale-95`

### 반응형 고려

```tsx
// isLandscape에 따른 레이아웃 분기
className={`${isLandscape ? 'flex-row' : 'flex-col'}`}
```

---

## 📝 새 컴포넌트 생성 시 체크리스트

- [ ] Props 인터페이스 정의
- [ ] 기본값 설정
- [ ] 반응형 레이아웃 고려 (isLandscape)
- [ ] 터치 인터랙션 구현
- [ ] DESIGN_SYSTEM_GUIDE.md 스타일 준수
- [ ] 이 문서에 항목 추가

---

**문서 버전**: 1.1.0  
**최종 수정**: 2026-01-19
