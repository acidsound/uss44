# 🎨 USS44 디자인 시스템 가이드

> **목적**: 일관된 UI/UX를 유지하고 기존 디자인을 보호하기 위한 포괄적인 디자인 시스템 문서
> 
> **작성일**: 2026-01-19
> 
> **적용 시점**: 
> - 새로운 컴포넌트 개발 시
> - 기존 UI 수정/개선 시
> - 코드 리뷰 시
> - 디자인 일관성 점검 시

---

## 📐 설계 원칙 (Design Principles)

### 1. 하드웨어 샘플러 미학 (Hardware Sampler Aesthetic)
USS44는 MPC, SP-404 같은 **하드웨어 샘플러**의 미학을 따릅니다.
- **물리적 버튼 느낌**: 눌림 효과, 그림자, 촉감적 피드백
- **LED 인디케이터**: 상태 표시를 위한 작은 발광 요소
- **LCD/디스플레이 영역**: 정보 표시 영역은 뚜렷한 구분
- **패널 분리**: 기능별로 명확히 분리된 영역

### 2. 다크 모드 우선 (Dark Mode First)
- 무대 조명 아래서도 눈부심 방지
- 콘텐츠 강조를 위한 낮은 휘도 배경
- 액센트 색상이 돋보이도록 설계

### 3. 터치 친화적 (Touch Friendly)
- 모든 인터랙티브 요소는 최소 44x44px 터치 영역
- 멀티 터치 지원 고려
- 제스처 기반 인터랙션

### 4. 반응형 레이아웃 (Responsive Layout)
- Portrait(세로), Landscape(가로) 모드 전환 지원
- 핵심 기능은 양쪽 모드에서 동일하게 접근 가능

---

## 🎨 색상 시스템 (Color System)

### 핵심 색상 팔레트 (Core Palette)

USS44의 색상은 Tailwind CSS 커스텀 테마로 정의됩니다. **절대 하드코딩된 색상 값을 사용하지 마세요.**

```javascript
// index.html - tailwind.config
colors: {
  retro: {
    bg: '#121214',        // 앱 배경 (Main Background)
    panel: '#1e1e22',     // 패널 배경 (Panel Background)  
    pad: '#2d2d32',       // 패드 기본 색상 (Pad Base)
    accent: '#ff1e56',    // 주요 강조색 - 빨강 (Primary Accent - Red)
    highlight: '#ff4d7d', // 밝은 강조색 (Light Accent)
    text: '#ffffff',      // 기본 텍스트 (Primary Text)
    muted: '#a0a0ab',     // 보조 텍스트 (Secondary Text)
    screen: '#2a0a10',    // LCD 스크린 배경 (Screen BG)
  },
  channel: {
    a: '#ff6b3d',         // 채널 A - 오렌지
    b: '#33e1ff',         // 채널 B - 시안
    c: '#bf7aff',         // 채널 C - 퍼플
    d: '#33ff8a',         // 채널 D - 그린
  }
}
```

### 색상 사용 규칙

| 용도 | Tailwind Class | 예시 |
|-----|----------------|------|
| 앱 배경 | `bg-retro-bg` | 최상위 컨테이너 |
| 패널/섹션 배경 | `bg-retro-panel` | 헤더, 푸터, 사이드바 |
| 패드/버튼 배경 | `bg-retro-pad` | 비활성 패드 |
| 주요 강조 요소 | `text-retro-accent`, `bg-retro-accent` | 활성 상태, 중요 버튼 |
| 기본 텍스트 | `text-white` 또는 `text-retro-text` | 제목, 레이블 |
| 보조 텍스트 | `text-zinc-400`, `text-zinc-500` | 설명, 힌트 |
| 비활성 요소 | `text-zinc-600`, `bg-zinc-800` | 비활성 버튼 |

### ⚠️ 색상 금지 규칙

```typescript
// ❌ 하지 마세요
className="bg-[#ff0000]"       // 하드코딩된 색상
className="text-red-500"       // retro-accent 대신 red 사용
style={{ color: '#ffffff' }}   // 인라인 스타일 색상

// ✅ 이렇게 하세요
className="bg-retro-accent"
className="text-retro-accent"
className="text-white"
```

### 동적 색상 예외

특별한 경우(예: 벨로시티 기반 강도 표현)에만 인라인 스타일 허용:

```typescript
// ✅ 허용되는 동적 색상
const intensity = velocity / 127;
style={{
  borderColor: `rgba(255, 30, 86, ${intensity})`,  // retro-accent의 rgba 변형
  boxShadow: `0 0 ${8 * intensity}px rgba(255, 30, 86, 0.4)`
}}
```

---

## 📐 레이아웃 시스템 (Layout System)

### 앱 구조

```
┌─────────────────────────────────────┐
│              [Header]               │  ← h-12 (Portrait), w-12 sidebar (Landscape)
│  Logo | LCD Display | Actions       │
├─────────────────────────────────────┤
│           [Mode Selector]           │  ← h-6 (Portrait only)
│   DIG | PERFORM/EDIT | SEQ | PLAY   │
├─────────────────────────────────────┤
│                                     │
│           [Main Content]            │  ← flex-1
│           (Pad Grid)                │
│                                     │
├─────────────────────────────────────┤
│           [Footer Panel]            │  ← min-h-32 max-h-64 (Portrait)
│   SequencePanel / ParametersPanel   │     w-1/2 (Landscape)
└─────────────────────────────────────┘
```

### 레이아웃 클래스 패턴

```typescript
// 메인 앱 컨테이너
className={`
  flex ${isLandscape ? 'flex-row' : 'flex-col'}
  w-full h-full
  bg-retro-bg text-retro-text
  font-sans select-none overflow-hidden
`}

// 헤더
className="flex-none z-30 flex flex-col bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800"

// 메인 콘텐츠 영역
className={`flex-1 flex flex-col ${isLandscape ? 'pl-12' : ''} overflow-hidden bg-retro-bg min-h-0 relative`}

// 푸터/패널 영역
className={`
  ${isLandscape ? 'w-1/2 border-l h-full' : 'flex-none w-full border-t min-h-32 max-h-64'}
  bg-retro-panel border-zinc-800/80
  flex flex-col shadow-2xl z-20 overflow-hidden
`}
```

### 반응형 레이아웃 규칙

| 화면 방향 | 레이아웃 | 주요 변경점 |
|-----------|----------|-------------|
| Portrait | 세로 배치 | Header(상단) → Main → Footer(하단) |
| Landscape | 가로 배치 | Sidebar(좌) → Main(중앙) → Panel(우) |

```typescript
// 반응형 레이아웃 감지
const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

useEffect(() => {
  const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

---

### 스크롤바 레이아웃 일관성 (Scrollbar Layout Consistency)

스크롤바가 나타나거나 사라질 때 레이아웃이 미세하게 좌우로 흔들리는 현상(**Layout Shift**)을 방지하기 위해 다음 규칙을 적용합니다.

- **`scrollbar-gutter: stable`**: 항목 개수에 따라 스크롤바가 생겼다 사라졌다 하는 리스트, 모달, 검색 결과 영역 등에 필수적으로 적용합니다.
- **적용 예시**:
```typescript
<div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
  {/* Scrollable Content */}
</div>
```

---

## 🔲 컴포넌트 스타일 가이드 (Component Style Guide)

### 1. 패드 (Pad)

패드는 USS44의 핵심 UI 요소입니다.

#### 기본 스타일
```typescript
className={`
  relative
  transition-all duration-75
  flex flex-col items-center justify-center
  overflow-hidden rounded-xl
  border
  active:shadow-none active:translate-x-[2px] active:translate-y-[2px]
  w-full h-full min-h-0 min-w-0
  ${!isSequenceMode ? 'shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]' : ''}
`}
```

#### 패드 상태별 스타일

| 상태 | 배경 | 테두리 | 기타 |
|------|------|--------|------|
| 기본 | `bg-retro-pad` | `border-zinc-800/80` | `hover:border-zinc-600` |
| 선택됨 | `bg-zinc-700` | `border-white` | `ring-4 ring-white/10 z-10` |
| 재생중 (Seq) | `bg-retro-accent/20` | `border-retro-accent` | `ring-4 ring-retro-accent/60 shadow-[0_0_20px]` |
| 비활성 (샘플 없음) | `bg-retro-pad` | `border-zinc-800/80` | `opacity-30 grayscale` |
| 뮤트/솔로 | - | - | `opacity-30 grayscale` |

#### LED 인디케이터
```typescript
// 패드 좌측 상단 LED
<div className={`
  absolute top-2 left-2
  w-2 h-2 rounded-full
  border border-black/50 shadow-sm
  transition-colors duration-75
  ${isActive 
    ? 'bg-retro-accent shadow-[0_0_8px_#ff1e56]' 
    : 'bg-zinc-900'
  }
`} />
```

### 2. 버튼 (Buttons)

#### 기본 버튼
```typescript
className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white 
           rounded-lg transition-colors active:scale-95"
```

#### 강조 버튼 (Primary)
```typescript
className="px-4 py-2 bg-retro-accent hover:bg-retro-highlight text-white 
           rounded-lg font-extrabold uppercase tracking-widest transition-all active:scale-95"
```

#### 탭/토글 버튼
```typescript
// 비활성
className="flex-1 flex items-center justify-center gap-2 text-[10px] font-extrabold 
           uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all"

// 활성
className="flex-1 flex items-center justify-center gap-2 text-[10px] font-extrabold 
           uppercase tracking-widest bg-retro-accent text-white shadow-inner transition-all"
```

#### 아이콘 버튼
```typescript
className="p-2 text-zinc-400 hover:text-white transition-colors active:scale-95"
```

### 3. 모달 (Modal)

#### 모달 오버레이
```typescript
className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm 
           flex items-center justify-center p-4 
           animate-in fade-in duration-200"
```

#### 모달 박스
```typescript
className="w-full max-w-sm bg-[#121214] border border-white/10 
           rounded-3xl overflow-hidden shadow-2xl 
           flex flex-col gap-4 p-6"
```

#### 모달 헤더
```typescript
<div className="flex justify-between items-center mb-2">
  <h2 className="text-xl font-extrabold uppercase tracking-tighter text-white">
    Modal Title
  </h2>
  <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
    <X size={24} />
  </button>
</div>
```

### 4. 입력 필드 (Input Fields)

```typescript
className="w-full bg-zinc-900/50 border border-white/5 rounded-xl 
           py-2.5 pl-10 pr-4 
           text-[11px] font-extrabold text-white 
           focus:border-retro-accent/50 focus:bg-zinc-900/80 focus:outline-none 
           transition-all placeholder:text-zinc-700"
```

### 5. 노브 (Knob)

노브 컴포넌트는 `components/Knob.tsx`에 정의되어 있습니다.

```typescript
// 노브 컨테이너
className="flex flex-col items-center gap-1 select-none w-full touch-none"

// 노브 본체
className={`
  relative w-14 h-14 rounded-full 
  bg-zinc-800 border-2 shadow-2xl 
  cursor-ns-resize transition-all
  ${dragging 
    ? 'border-retro-accent ring-4 ring-retro-accent/20' 
    : 'border-zinc-700 hover:border-zinc-500'
  }
`}

// 노브 인디케이터
className={`w-1.5 h-4 mx-auto mt-1 rounded-full shadow-[0_0_8px_rgba(255,30,86,0.6)] 
            ${dragging ? 'bg-white' : 'bg-retro-accent'}`}

// 노브 레이블
className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider"

// 노브 값 표시
className="bg-black/40 px-2 py-0.5 rounded border border-white/5 min-w-[50px] text-center"
// 내부 텍스트
className="text-[11px] font-extrabold text-retro-accent glow-red"
```

### 6. 파형 편집기 (Waveform Editor)

#### 색상 규칙
| 요소 | 색상 |
|------|------|
| 배경 | `#0a0a0c` |
| 파형 라인 | `#ff3c6a` |
| 시작 마커 | `#00ffcc` |
| 종료 마커 | `#ffdd00` |
| 재생 헤드 | `#ffffff` |
| 그리드 라인 | `rgba(255, 255, 255, 0.03)` |
| 중앙선 | `rgba(255, 255, 255, 0.1)` |

---

## ✏️ 타이포그래피 (Typography)

### 폰트 패밀리

```javascript
fontFamily: {
  mono: ['"JetBrains Mono"', '"Courier New"', 'Courier', 'monospace'],
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
```

### 폰트 사용 규칙

| 용도 | 폰트 | 스타일 |
|------|------|--------|
| 기본 UI | `font-sans` (Inter) | 모든 UI 텍스트 |
| 숫자/코드 | `font-mono` (JetBrains Mono) | BPM, 시간, 값 표시 |

### 텍스트 크기 가이드

| 용도 | 크기 | Weight | 추가 클래스 |
|------|------|--------|-------------|
| 앱 제목 | `text-base` | `font-extrabold` | `tracking-tighter` |
| 섹션 헤더 | `text-xl` | `font-extrabold` | `uppercase tracking-tighter` |
| 버튼 레이블 | `text-[10px]` | `font-extrabold` | `uppercase tracking-widest` |
| 패드 레이블 | `text-[11px]` | `font-extrabold` | `uppercase tracking-tighter` |
| 작은 레이블 | `text-[8px]` | `font-extrabold` | `uppercase tracking-widest` |
| 값 표시 | `text-[11px]` | `font-extrabold` | - |
| 도움말/힌트 | `text-[9px]` | `font-bold` | `text-zinc-500` |

### 텍스트 스타일 예시

```typescript
// 헤더 타이틀
<h1 className="text-base font-extrabold tracking-tighter text-white">
  USS<span className="text-retro-accent">44</span>
</h1>

// 섹션 헤더
<h2 className="text-xl font-extrabold uppercase tracking-tighter text-white">
  Tempo Control
</h2>

// 작은 레이블
<span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">
  PITCH
</span>

// 값 표시 (강조)
<span className="text-[11px] font-extrabold text-retro-accent glow-red">
  {value.toFixed(2)}
</span>
```

---

## ✨ 효과 및 애니메이션 (Effects & Animation)

### 그림자 (Shadows)

| 용도 | 클래스 |
|------|--------|
| 패드 3D 효과 | `shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]` |
| 모달 | `shadow-2xl` |
| 활성 LED | `shadow-[0_0_8px_#ff1e56]` |
| 글로우 효과 | `shadow-[0_0_15px_rgba(255,30,86,0.3)]` |

### 글로우 효과

```css
/* index.html에 정의됨 */
.glow-red {
  text-shadow: 0 0 8px rgba(255, 30, 86, 0.6);
}

.bg-glow-red {
  box-shadow: 0 0 15px rgba(255, 30, 86, 0.3);
}
```

### 전환 효과 (Transitions)

```typescript
// 빠른 전환 (버튼 호버, 패드 터치)
className="transition-all duration-75"

// 일반 전환
className="transition-colors"  // 색상만
className="transition-all"     // 모든 속성

// 특정 지연
className="transition-all duration-200"
className="transition-all duration-300"
```

### 애니메이션 (Animations)

```typescript
// 펄스 (활성 상태)
className="animate-pulse"

// 느린 회전
className="animate-spin-slow"  // 커스텀: 3s

// 진입 애니메이션 (animate-in 플러그인 사용)
className="animate-in fade-in duration-200"
className="animate-in slide-in-from-bottom-4 duration-300"
className="animate-in fade-in slide-in-from-right-2 duration-500"
```

### 상호작용 피드백

```typescript
// 버튼 클릭 효과
className="active:scale-95"

// 패드 눌림 효과
className="active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"

// 호버 밝기
className="brightness-110"  // 패드 홀드 시
```

---

## 📏 간격 시스템 (Spacing System)

Tailwind의 기본 간격 스케일을 사용합니다.

### 권장 간격 값

| 용도 | 값 | 예시 |
|------|-----|------|
| 최소 간격 | `gap-0.5`, `p-0.5` | 밀접한 요소 |
| 작은 간격 | `gap-1`, `p-1` | 아이콘 내부 |
| 기본 간격 | `gap-2`, `p-2` | 버튼 그룹 |
| 중간 간격 | `gap-4`, `p-4` | 섹션 패딩 |
| 큰 간격 | `gap-6`, `p-6` | 모달 패딩 |

### 고정 크기

| 요소 | 값 |
|------|-----|
| 헤더 높이 (Portrait) | `h-12` |
| 모드 선택기 높이 | `h-6` |
| 노브 크기 | `w-14 h-14` |
| LED 크기 | `w-2 h-2` |
| 아이콘 버튼 | `p-2` |
| 패널 최소 높이 | `min-h-32` |
| 패널 최대 높이 | `max-h-64` |

---

## 🚫 Anti-Patterns (하지 말아야 할 것들)

### 1. 색상 하드코딩 금지

```typescript
// ❌ 금지
className="bg-[#ff0000]"
className="text-red-500"
style={{ backgroundColor: 'red' }}

// ✅ 올바른 방법
className="bg-retro-accent"
className="text-retro-accent"
```

### 2. 임의의 간격 값 사용 금지

```typescript
// ❌ 금지
className="p-[17px]"
className="gap-[13px]"

// ✅ 올바른 방법 - Tailwind 스케일 사용
className="p-4"
className="gap-3"
```

### 3. 인라인 스타일 남용 금지

```typescript
// ❌ 금지 (정적 스타일)
style={{ fontSize: '11px', fontWeight: 'bold' }}

// ✅ 올바른 방법
className="text-[11px] font-bold"
```

### 4. 폰트 직접 지정 금지

```typescript
// ❌ 금지
className="font-['Arial']"
style={{ fontFamily: 'Helvetica' }}

// ✅ 올바른 방법
className="font-sans"  // Inter
className="font-mono"  // JetBrains Mono
```

### 5. 기존 컴포넌트 임의 수정 금지

새 스타일을 추가할 때는 기존 패턴을 따르세요:
- 기존 컴포넌트의 스타일을 변경하기 전에 이 가이드 확인
- 새 상태/변형이 필요하면 조건부 클래스로 추가
- 전역적인 변경은 팀과 논의 후 진행

---

## ✅ 체크리스트 (Implementation Checklist)

### 새 컴포넌트 생성 시

- [ ] 색상은 retro/channel 팔레트만 사용
- [ ] 간격은 Tailwind 스케일 사용
- [ ] 폰트는 font-sans 또는 font-mono만 사용
- [ ] 레이블/버튼 텍스트는 uppercase + font-extrabold
- [ ] 전환 효과 포함 (transition-all 또는 transition-colors)
- [ ] 터치 인터랙션 고려 (active:scale-95 등)
- [ ] 반응형 레이아웃 고려 (isLandscape 분기)

### 기존 컴포넌트 수정 시

- [ ] 기존 스타일 패턴 확인
- [ ] 변경 전후 비교 스크린샷 캡처
- [ ] 다른 화면 비율에서 테스트
- [ ] 다크 모드 대비 확인

### PR 전 UI 검증

```bash
# 1. 하드코딩된 색상 검색
grep -rn "bg-\[#" --include="*.tsx" .
grep -rn "text-\[#" --include="*.tsx" .
grep -rn "border-\[#" --include="*.tsx" .

# 2. 비표준 폰트 검색
grep -rn "font-\[" --include="*.tsx" .

# 3. 인라인 스타일 사용 확인 (동적 값 제외)
grep -rn "style={{" --include="*.tsx" .
```

---

## 📚 참고 자료

### 관련 문서
- [CODE_QUALITY_GUIDE.md](./CODE_QUALITY_GUIDE.md) - 코드 품질 관리
- [TERMINOLOGY.md](../TERMINOLOGY.md) - 용어 정의
- [DEVELOPMENT.md](../DEVELOPMENT.md) - 개발 가이드

### 외부 참고
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons) - 아이콘 라이브러리
- [Inter Font](https://fonts.google.com/specimen/Inter)
- [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-01-19 | 초기 문서 작성 |

---

**문서 버전**: 1.0.0  
**최종 수정**: 2026-01-19  
**담당자**: Development Team
