# 🧪 USS44 테스트 전략

> **목적**: 테스트 전략, 테스트 케이스, 향후 테스트 구현 방향 문서화
> 
> **작성일**: 2026-01-19
> 
> **현재 상태**: 테스트 미구현 (수동 테스트 중심)

---

## 📋 테스트 범위

### 핵심 기능 (Critical Path)

| 기능 | 우선순위 | 현재 상태 |
|------|----------|----------|
| 패드 트리거/재생 | 🔴 높음 | 수동 |
| 시퀀서 재생/정지 | 🔴 높음 | 수동 |
| 샘플 로드 | 🔴 높음 | 수동 |
| 프로젝트 저장/로드 | 🟡 중간 | 수동 |
| 파형 편집 | 🟡 중간 | 수동 |
| 녹음 | 🟡 중간 | 수동 |

---

## 🎯 수동 테스트 체크리스트

### 앱 초기화
- [ ] InitOverlay 터치 시 앱 시작
- [ ] Factory Sample Pack 자동 로드
- [ ] 이전 세션 데이터 복원

### 패드 그리드
- [ ] 패드 터치 → 소리 재생
- [ ] 패드 터치 해제 → 소리 정지 (GATE 모드)
- [ ] 멀티터치 동시 재생
- [ ] 채널 전환 (A/B/C/D)
- [ ] 패드 선택 상태 표시

### 시퀀서
- [ ] Play/Stop 동작
- [ ] 스텝 토글 (활성화/비활성화)
- [ ] 현재 스텝 표시 (재생 헤드)
- [ ] BPM 변경 적용
- [ ] 16/64 스텝 전환

### 파라미터
- [ ] Pitch 노브 조작
- [ ] Gain 노브 조작
- [ ] Pan 노브 조작
- [ ] Cutoff 노브 조작
- [ ] 더블클릭 기본값 리셋

### 파형 편집
- [ ] 시작/끝 마커 드래그
- [ ] 줌 인/아웃
- [ ] Auto Crop
- [ ] 트리거 모드 전환

### 저장/로드
- [ ] 프로젝트 자동 저장
- [ ] JSON 내보내기
- [ ] JSON 가져오기
- [ ] Init All (공장 초기화)

### 반응형
- [ ] Portrait → Landscape 전환
- [ ] Landscape → Portrait 전환
- [ ] 레이아웃 깨짐 없음

---

## 🚀 향후 테스트 구현 계획

### Phase 1: 유닛 테스트

**대상**: 순수 함수, 유틸리티

```typescript
// 예: utils/audioUtils.ts
describe('generateWaveform', () => {
  it('should return 200 points', () => {
    const buffer = createMockAudioBuffer();
    const waveform = generateWaveform(buffer);
    expect(waveform.length).toBe(200);
  });
});

describe('detectBPM', () => {
  it('should detect ~120 BPM for 120 BPM sample', () => {
    const buffer = create120BpmSample();
    const bpm = detectBPM(buffer);
    expect(bpm).toBeCloseTo(120, 5);
  });
});
```

**도구**: Vitest

### Phase 2: 컴포넌트 테스트

**대상**: 개별 컴포넌트 렌더링/인터랙션

```typescript
// 예: components/Knob.test.tsx
describe('Knob', () => {
  it('should render with label', () => {
    render(<Knob label="PITCH" ... />);
    expect(screen.getByText('PITCH')).toBeInTheDocument();
  });

  it('should call onChange on drag', () => {
    const onChange = vi.fn();
    render(<Knob onChange={onChange} ... />);
    // 드래그 시뮬레이션
    expect(onChange).toHaveBeenCalled();
  });
});
```

**도구**: Vitest + React Testing Library

### Phase 3: 통합 테스트

**대상**: 스토어 + 컴포넌트 상호작용

```typescript
describe('Pad Trigger Flow', () => {
  it('should play sound when pad is touched', async () => {
    // 1. 샘플 로드
    // 2. 패드 터치
    // 3. audioStore.triggerPad 호출 확인
  });
});
```

### Phase 4: E2E 테스트

**대상**: 전체 사용자 시나리오

```typescript
// 예: Playwright
test('complete workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('#init-overlay');  // 앱 시작
  await page.click('#pad-0');          // 패드 터치
  // 오디오 재생 확인은 어려움 - UI 상태로 검증
  await expect(page.locator('#pad-0')).toHaveClass(/ring-4/);
});
```

**도구**: Playwright

---

## ⚠️ 테스트 제약 사항

### Web Audio API 테스트 어려움

- AudioContext는 브라우저 환경 필요
- 실제 오디오 출력 검증 어려움
- 해결책: AudioContext 모킹, 상태 변화 중심 테스트

### 터치 인터랙션

- 멀티터치 시뮬레이션 복잡
- 해결책: Playwright의 touchscreen API 활용

### IndexedDB

- 테스트 간 격리 필요
- 해결책: fake-indexeddb 라이브러리

---

## 📊 테스트 커버리지 목표

| 단계 | 목표 | 기한 |
|------|------|------|
| Phase 1 | 유틸 함수 80% | - |
| Phase 2 | 컴포넌트 60% | - |
| Phase 3 | 핵심 플로우 100% | - |
| Phase 4 | Critical Path E2E | - |

---

## 🛠️ 테스트 환경 설정 (미래)

```json
// package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "playwright": "^1.40.0",
    "fake-indexeddb": "^5.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

---

**문서 버전**: 1.0.0  
**최종 수정**: 2026-01-19
