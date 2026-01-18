---
description: USS44 개발 시 따라야 할 코드 품질 및 디자인 가이드라인
---

# USS44 개발 워크플로우

이 프로젝트에서 코드를 작성하거나 수정할 때는 다음 가이드라인을 반드시 확인하고 준수합니다.

## 필수 참조 문서

### 코드/로직 관련
1. **코드 품질 가이드**: `docs/CODE_QUALITY_GUIDE.md`
   - 6대 코드 품질 평가 기준, PR 전 체크리스트

2. **용어 정의**: `TERMINOLOGY.md`
   - 프로젝트 전반에서 사용하는 용어의 정의

3. **개발 문서**: `DEVELOPMENT.md`
   - 아키텍처 및 로직 설명

### 디자인/UI 관련
4. **디자인 시스템 가이드**: `docs/DESIGN_SYSTEM_GUIDE.md`
   - 색상 팔레트, 컴포넌트 스타일, 타이포그래피

5. **컴포넌트 카탈로그**: `docs/COMPONENT_CATALOG.md`
   - 각 컴포넌트의 Props, 사용 예시

### 심화 문서
6. **상태 관리**: `docs/STATE_MANAGEMENT.md`
   - Zustand 스토어 구조, 상태 흐름

7. **오디오 엔진**: `docs/AUDIO_ENGINE.md`
   - Web Audio API, AudioWorklet 구조

8. **문제 해결**: `docs/TROUBLESHOOTING.md`
   - 자주 발생하는 문제와 해결 방법

9. **테스트 전략**: `docs/TESTING_STRATEGY.md`
   - 테스트 계획 및 체크리스트

## 개발 시 체크리스트

### UI 작업 시
- [ ] 색상: `retro-*`, `channel-*` 팔레트만 사용 (하드코딩 금지)
- [ ] 간격: Tailwind 스케일 사용 (임의 값 금지)
- [ ] 폰트: `font-sans` 또는 `font-mono`만 사용
- [ ] 레이블: `uppercase font-extrabold` 패턴 따르기
- [ ] 전환 효과: `transition-all` 또는 `transition-colors` 포함
- [ ] 터치 피드백: `active:scale-95` 등 포함
- [ ] 반응형: `isLandscape` 분기 고려

### 로직 작업 시
- [ ] 중복 코드 확인 (3회 이상 반복 시 함수로 추출)
- [ ] 용어 일관성 확인 (TERMINOLOGY.md 참조)
- [ ] any 타입 사용 최소화
- [ ] 매직 넘버는 상수로 추출

## Git 및 배포 정책

- **임의 작업 금지**: 사용자가 명시적으로 `commit`, `push`, 또는 `배포`를 요청하지 않은 경우, 코드를 수정한 후 자동으로 Git 작업을 수행하지 않습니다.
- **요청 시에만 수행**: 모든 Git 인터랙션은 사용자의 직접적인 허가가 있거나 명확한 지시가 있을 때만 진행합니다.
- **배포 확인**: 배포가 필요한 경우 사용자에게 완료 여부를 묻거나 명시적 승인을 받은 후 처리를 제안합니다.

## PR 전 검증 명령어

```bash
# 하드코딩된 색상 검색
grep -rn "bg-\[#" --include="*.tsx" .
grep -rn "text-\[#" --include="*.tsx" .

# any 타입 사용 확인
grep -rn ": any" --include="*.ts" --include="*.tsx" .

# TODO 확인
grep -rn "TODO\|FIXME" --include="*.ts" --include="*.tsx" .
```
