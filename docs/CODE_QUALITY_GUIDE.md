# 📐 USS44 코드 품질 관리 가이드

> **목적**: 일관된 기준으로 코드베이스를 분석하고 개선하기 위한 체크리스트 및 방법론
> 
> **작성일**: 2026-01-18
> 
> **적용 시점**: 
> - 주요 기능 추가 후
> - 리팩토링 전
> - 코드 리뷰 시
> - 분기별 정기 점검

---

## 🎯 6대 코드 품질 평가 기준

### 1. 사용되지 않는 코드 (Dead Code)

#### ✅ 체크 항목
- [ ] 정의되었으나 import/호출되지 않는 함수
- [ ] export되었으나 어디에서도 사용되지 않는 상수
- [ ] 주석 처리된 코드 블록
- [ ] 조건이 항상 false인 코드 경로

#### 🔍 검증 방법

```bash
# 1. 특정 export가 사용되는지 확인
grep -r "import.*CONSTANT_NAME" --include="*.ts" --include="*.tsx" .

# 2. 함수 호출 여부 확인
grep -r "functionName(" --include="*.ts" --include="*.tsx" .

# 3. TypeScript unused imports/exports 감지
npx ts-unused-exports tsconfig.json --silent

# 4. ESLint로 사용되지 않는 변수 감지
npx eslint --ext .ts,.tsx --rule 'no-unused-vars: error' .
```

#### 📏 판단 기준
- **삭제**: 3개월 이상 사용되지 않은 코드
- **보류**: TODO 주석과 함께 명시적 계획이 있는 경우
- **문서화**: 외부 API용으로 export된 경우 주석 추가

---

### 2. 구현 누락 (Missing Implementation)

#### ✅ 체크 항목
- [ ] 문서에 명시되었으나 구현되지 않은 기능
- [ ] 타입은 정의되었으나 실제 사용되지 않는 필드
- [ ] TODO/FIXME 주석이 달린 코드
- [ ] 문서 간 불일치 (TERMINOLOGY.md ↔ DEVELOPMENT.md)

#### 🔍 검증 방법

```bash
# 1. TODO/FIXME 태그 찾기
grep -rn "TODO\|FIXME" --include="*.ts" --include="*.tsx" .

# 2. 문서와 코드 비교
# - TERMINOLOGY.md의 용어를 코드에서 검색
# - DEVELOPMENT.md의 아키텍처 설명과 실제 파일 구조 비교

# 3. 타입 정의와 실제 사용 비교
grep -A 5 "interface.*Envelope" types.ts
grep -r "envelope\." --include="*.ts" --include="*.tsx" .
```

#### 📏 판단 기준
- **즉시 구현**: 외부 사용자에게 약속된 기능
- **이슈 등록**: 향후 버전에 계획된 기능
- **문서 수정**: 더 이상 필요 없는 기능

---

### 3. 중복/중첩 구현 (Duplication)

#### ✅ 체크 항목
- [ ] 동일/유사한 로직이 2곳 이상에 구현
- [ ] 같은 목적의 함수가 다른 알고리즘으로 구현
- [ ] 반복되는 문자열/숫자 패턴 (ID 생성 등)
- [ ] 유사한 컴포넌트 구조

#### 🔍 검증 방법

```bash
# 1. 특정 패턴이 반복되는지 검색
grep -rn '\${.*}-\${.*}' --include="*.ts" --include="*.tsx" .

# 2. 함수명 유사도 검색
find . -name "*.ts" -o -name "*.tsx" | xargs grep -h "^export.*function\|^const.*=" | sort

# 3. Copy-Paste Detector 도구 사용
npx jscpd --min-lines 5 --min-tokens 50 src/

# 4. 수동 검토: 핵심 유틸리티 함수
# - waveform 생성
# - ID 생성
# - 데이터 변환
```

#### 📏 판단 기준
- **3회 이상 반복**: 반드시 함수/상수로 추출
- **2회 반복**: 컨텍스트에 따라 판단 (향후 확장 가능성)
- **알고리즘 불일치**: 더 나은 알고리즘으로 통일

#### 🛠️ 리팩토링 패턴
```typescript
// ❌ Before: 중복
// fileA.ts
const id = `${channel}-${index}`;
// fileB.ts
const id = `${channel}-${index}`;

// ✅ After: 추출
// utils/idGenerator.ts
export const createPadId = (channel: ChannelId, index: number) => 
  `${channel}-${index}`;
```

---

### 4. 용어/Convention 충돌 (Naming Consistency)

#### ✅ 체크 항목
- [ ] 동일 개념에 다른 용어 사용 (Bank vs Channel)
- [ ] 네이밍 스타일 불일치 (camelCase vs snake_case)
- [ ] 약어 사용 기준 불명확 (btn vs button)
- [ ] 문서 용어와 코드 용어 불일치

#### 🔍 검증 방법

```bash
# 1. 용어 사용 빈도 분석
grep -ro "\bChannel\b" --include="*.ts" --include="*.tsx" . | wc -l
grep -ro "\bBank\b" --include="*.ts" --include="*.tsx" . | wc -l

# 2. 네이밍 스타일 검사
grep -rn "[a-z]_[a-z]" --include="*.ts" --include="*.tsx" .  # snake_case
grep -rn "[A-Z][a-z]*[A-Z]" --include="*.ts" --include="*.tsx" .  # PascalCase

# 3. TERMINOLOGY.md와 코드 비교
cat TERMINOLOGY.md | grep "^\| \*\*" | cut -d'*' -f3
```

#### 📏 판단 기준

| 상황 | 조치 |
|-----|-----|
| 문서 간 용어 불일치 | TERMINOLOGY.md를 단일 진실 소스로 설정 |
| 코드와 문서 불일치 | 코드 우선, 문서 업데이트 (Breaking Change 최소화) |
| 외부 표준 존재 | 업계 표준 따르기 (예: MIDI, MPC 용어) |
| 역사적 이유 | 주석으로 설명 추가 |

---

### 5. 컴포넌트/함수 응집도 (Cohesion & Separation)

#### ✅ 체크 항목
- [ ] 500줄 이상의 파일
- [ ] 5개 이상의 책임을 가진 함수/컴포넌트
- [ ] useEffect가 5개 이상인 컴포넌트
- [ ] 너무 깊은 중첩 (3단계 이상)

#### 🔍 검증 방법

```bash
# 1. 파일 크기 분석
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -20

# 2. 함수 복잡도 분석 (Cyclomatic Complexity)
npx es6-plato -r -d report src/

# 3. useEffect 개수 세기
grep -c "useEffect" components/*.tsx

# 4. 중첩 깊이 시각화
# VS Code Extension: Indent Rainbow
```

#### 📏 판단 기준

| 지표 | 양호 | 주의 | 위험 |
|-----|-----|-----|-----|
| 파일 라인 수 | < 200 | 200-500 | > 500 |
| 함수 파라미터 | < 3 | 3-5 | > 5 |
| useEffect 개수 | < 3 | 3-5 | > 5 |
| 중첩 깊이 | < 3 | 3-4 | > 4 |

#### 🛠️ 리팩토링 패턴

```typescript
// ❌ Before: 거대한 컴포넌트
const App = () => {
  // 300 lines of logic
};

// ✅ After: Custom Hooks + 작은 컴포넌트
const useKeyboardHandler = () => { /* ... */ };
const useSequencerScheduler = () => { /* ... */ };

const App = () => {
  useKeyboardHandler();
  useSequencerScheduler();
  return <Layout />;
};
```

---

### 6. 가독성 및 명확성 (Readability)

#### ✅ 체크 항목
- [ ] 매직 넘버/문자열 하드코딩
- [ ] any 타입 사용
- [ ] 주석 없는 복잡한 로직
- [ ] 의미 불명확한 변수명

#### 🔍 검증 방법

```bash
# 1. 매직 넘버 찾기
grep -rn "[^0-9a-zA-Z][0-9]\{2,\}[^0-9]" --include="*.ts" --include="*.tsx" . | grep -v "//"

# 2. any 타입 사용 찾기
grep -rn ": any\|<any>" --include="*.ts" --include="*.tsx" .

# 3. 짧은 변수명 찾기 (1-2글자)
grep -rn "\b[a-z]\{1,2\}\b\s*=" --include="*.ts" --include="*.tsx" .

# 4. 주석 비율 체크
cloc --include-lang=TypeScript --by-file src/
```

#### 📏 판단 기준

**매직 넘버**:
- 0, 1, -1: OK (일반적)
- 2-10: 변수명으로 설명
- 10 이상: 상수로 추출

**변수명**:
- ❌ `i`, `j`, `k` (루프 외)
- ❌ `data`, `temp`, `result`
- ✅ `selectedPadIndex`, `waveformPoints`

**주석**:
- 복잡도 > 15: 주석 필수
- Public API: JSDoc 필수
- 알고리즘: 참고 링크 포함

---

## 📋 정기 점검 체크리스트

### 매 PR 전

```bash
# Quick Check (5분)
□ npx eslint --ext .ts,.tsx src/
□ npx tsc --noEmit
□ grep -r "TODO\|FIXME\|XXX" src/
□ git diff --check  # 공백 문제
```

### 주간 점검

```bash
# 파일 크기 모니터링
□ find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -10

# 중복 코드 감지
□ npx jscpd src/

# 타입 안전성
□ grep -r ": any" src/ | wc -l
```

### 월간 점검

```bash
# 전체 코드 품질 리포트
□ npx es6-plato -r -d report src/
□ npx ts-unused-exports tsconfig.json
□ 문서 동기화 확인 (TERMINOLOGY.md ↔ types.ts)
```

### 분기별 점검

- [ ] 전체 리팩토링 분석 실행 (본 문서의 6대 기준)
- [ ] 아키텍처 리뷰 (DEVELOPMENT.md 업데이트)
- [ ] 기술 부채 백로그 정리

---

## 🔧 권장 도구

### 필수 도구

```json
{
  "devDependencies": {
    "eslint": "^8.x",
    "typescript": "^5.x",
    "@typescript-eslint/parser": "^6.x",
    "@typescript-eslint/eslint-plugin": "^6.x"
  }
}
```

### 선택 도구

```bash
# 코드 복잡도
npm install -g es6-plato

# 중복 코드 감지
npm install -g jscpd

# 사용되지 않는 코드
npm install -g ts-unused-exports

# 라인 수 카운트
brew install cloc  # macOS
```

### VS Code 확장

- **SonarLint**: 실시간 코드 품질 체크
- **Code Metrics**: 복잡도 표시
- **TODO Highlight**: TODO/FIXME 강조
- **Better Comments**: 주석 분류

---

## 📊 리팩토링 우선순위 결정 방법

### 점수 계산식

```
우선순위 점수 = (영향도 × 5) + (빈도 × 3) + (수정 난이도 × -2)
```

**영향도** (1-5):
1. 코드 스타일만 영향
2. 특정 파일만 영향
3. 모듈 전체 영향
4. 여러 모듈 영향
5. 시스템 전체 영향

**빈도** (1-5):
1. 1번만 발생
2. 2-3곳에서 발생
3. 4-10곳에서 발생
4. 10-50곳에서 발생
5. 50곳 이상

**수정 난이도** (1-5):
1. 5분 이내 (단순 삭제/이름 변경)
2. 30분 이내 (함수 추출)
3. 2시간 이내 (리팩토링)
4. 1일 이내 (구조 변경)
5. 1일 이상 (Breaking Change)

### 예시

| 이슈 | 영향도 | 빈도 | 난이도 | 점수 | 우선순위 |
|-----|-------|------|-------|------|---------|
| Waveform 중복 | 4 | 3 | 2 | 20+9-4=**25** | 🔴 High |
| MOCK_SOCIAL_FEED | 1 | 1 | 1 | 5+3-2=**6** | 🟢 Low |
| App.tsx 분할 | 3 | 5 | 4 | 15+15-8=**22** | 🔴 High |
| 매직 넘버 | 2 | 4 | 1 | 10+12-2=**20** | 🟡 Medium |

---

## 🎓 학습 자료

### Clean Code 원칙

1. **DRY (Don't Repeat Yourself)**: 중복 제거
2. **KISS (Keep It Simple, Stupid)**: 단순하게
3. **YAGNI (You Aren't Gonna Need It)**: 필요한 것만
4. **Single Responsibility**: 하나의 책임
5. **Open/Closed**: 확장에는 열려있고 수정에는 닫혀있게

### TypeScript 특화

- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Effective TypeScript](https://effectivetypescript.com/)
- [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

### React 특화

- [React Beta Docs](https://react.dev/)
- [Patterns.dev](https://www.patterns.dev/)
- [Kent C. Dodds Blog](https://kentcdodds.com/blog)

### 📱 모바일 터치/포인터 이벤트 처리

> **중요**: 모바일 웹 앱에서 반복적으로 발생하는 이슈입니다.

#### ⚠️ 지양해야 할 패턴

```typescript
// ❌ 문제: Touch + Mouse 이벤트 혼합 시 중복 트리거
return {
  onMouseDown: handler,
  onMouseUp: handler,
  onTouchStart: handler,  // 모바일에서 Mouse 이벤트도 함께 발생!
  onTouchEnd: handler,
};

// ❌ 문제: Passive Event Listener에서 preventDefault 호출
const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault();  // 경고: Unable to preventDefault inside passive event listener
};
```

#### ✅ 권장 패턴: PointerEvents 사용

```typescript
// ✅ PointerEvents는 Touch/Mouse/Pen 통합 처리
const useLongPress = (onLongPress: () => void, onClick: () => void, ms = 400) => {
  const timeoutRef = useRef<number>();
  const isLongPress = useRef(false);

  const start = () => {
    isLongPress.current = false;
    timeoutRef.current = window.setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
    }, ms);
  };

  const stop = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isLongPress.current) onClick();
    isLongPress.current = false;
  };

  const cancel = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    isLongPress.current = false;
  };

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
};
```

#### 📏 핵심 원칙

| 상황 | 권장 접근법 |
|-----|------------|
| 단순 탭/클릭 | `onClick` 사용 |
| 드래그/스와이프 | `onPointerDown/Move/Up` 사용 |
| 롱탭 + 탭 분기 | `onPointerDown/Up` + 타이머 조합 |
| 스크롤 영역 내 터치 | Passive listener 유지, `preventDefault` 지양 |

#### 🔍 디버깅 체크리스트

- [ ] 모바일에서 동일 액션이 2번 실행되는지 확인
- [ ] Console에 `passive event listener` 경고 없는지 확인
- [ ] Desktop과 Mobile에서 동일한 동작 확인

---

## 📝 리팩토링 실행 템플릿

### 이슈 제목 형식

```
[REFACTOR] 카테고리: 간단한 설명 (#이슈번호)

# 예시
[REFACTOR] Duplication: Waveform 생성 로직 통합 (#42)
[REFACTOR] Naming: Channel/Bank 용어 통일 (#43)
```

### Commit 메시지 형식

```
refactor(scope): 변경 내용

- 상세 내용 1
- 상세 내용 2

Closes #이슈번호
```

### PR 템플릿

```markdown
## 📌 리팩토링 목적
- [ ] 중복 제거
- [ ] 가독성 향상
- [ ] 성능 개선
- [ ] 구조 개선

## 🔍 변경 사항
- 변경 1
- 변경 2

## ✅ 검증
- [ ] 기존 테스트 통과
- [ ] 타입 에러 없음
- [ ] 동작 확인 완료

## 📊 영향도
**Breaking Change**: Yes / No
**영향받는 파일 수**: X개
```

---

## 🚀 빠른 시작 가이드

### 1단계: 현재 상태 파악 (10분)

```bash
# 1. 파일 크기 확인
find src -name "*.ts*" | xargs wc -l | sort -rn | head -10

# 2. TODO 확인
grep -rn "TODO\|FIXME" src/

# 3. any 사용 확인
grep -rn ": any" src/ | wc -l
```

### 2단계: 빠른 승리 (Quick Wins) (30분)

- [ ] 사용되지 않는 import 제거
- [ ] TODO 주석에 이슈 번호 추가
- [ ] 매직 넘버 3-5개 상수화

### 3단계: 주요 리팩토링 계획 (2시간)

1. 우선순위 점수 계산
2. 스프린트 백로그 작성
3. Breaking Change 여부 확인

---

## ✅ 성공 지표

### 단기 (1개월)

- [ ] 500줄 이상 파일 50% 감소
- [ ] any 타입 사용 20% 감소
- [ ] TODO 주석에 모두 이슈 번호 추가

### 중기 (3개월)

- [ ] 중복 코드 30% 감소
- [ ] 평균 파일 크기 300줄 이하
- [ ] 모든 Public API에 JSDoc 추가

### 장기 (6개월)

- [ ] Cyclomatic Complexity 평균 10 이하
- [ ] 테스트 커버리지 70% 이상
- [ ] 문서화율 90% 이상

---

## 📞 문의 및 제안

본 가이드에 대한 개선 사항이나 질문이 있으면:
1. GitHub Issue 생성
2. 팀 회의에서 논의
3. 이 문서를 직접 업데이트 (PR)

**문서 버전**: 1.0.0  
**최종 수정**: 2026-01-18  
**담당자**: Development Team
