# 📋 USS44 변경 이력 (Changelog)

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)

---

## [1.3.2] - 2026-01-21

### Improved
- **Smart Quantization**: `AudioContext.currentTime` 및 `performance.now()`를 결합한 고정밀 퀀타이즈 로직 적용. 이제 연주가 약간 늦더라도(50% 이내) 이전 정박에 정확히 붙습니다.
- **De-flam Logic**: 실시간 녹음 시 발생하는 중복 트리거(따닥 소리) 현상을 완전히 해결하여 연주감이 더욱 매끄러워졌습니다.
- **Keyboard Shortcuts**: Step(Sequence) 및 Song 모드에서도 키보드를 이용한 패드 연주 및 선택이 가능하도록 개선되었습니다.

### Fixed
- **Recording Stability**: 리얼타임 녹음 중 IndexedDB 저장 시 발생하던 `DataError` 예외 처리 및 안정화.
- **Input Jitter**: `App.tsx` 이벤트 리스너 최적화를 통해 모드 전환 시 입력이 누락되던 현상 수정.

---

## [1.3.1] - 2026-01-21

### Added
- **Visual Metronome (Beat Pulse)**: 리얼타임 레코딩 모드 시 화면 좌우 가장자리에 비트에 맞춘 시각적 펄스 효과 추가 (공연 및 소음 환경 대응)

---

## [1.3.0] - 2026-01-20

### Added
- **Song Mode**: 타일 기반 그리드 인터페이스를 통한 멀티 패턴 시퀀싱 기능 추가
- **Pattern Library**: 최대 16개(A-P) 패턴 확장 및 독립적 관리 지원
- **Pattern Selector**: 드래그 앤 드롭을 통한 패턴 순서 변경 및 더블 탭 삭제 기능
- **Header LCD Interaction**: PAT 영역 탭 시 패턴 사이클링, 롱 탭 시 패턴/채널 선택 모달 제공
- **Touch UX**: PointerEvents를 활용한 모바일 롱 프레스 및 정밀 드래그(좌/우 삽입 라인) 지원

### Changed
- IndexedDB 구조 개선: `Pattern > Pad > Steps` 계층 구조로 데이터 영속성 강화
- 프로젝트 저장/불러오기: 프로젝트 내 모든 16개 패턴 및 Song 구성을 포함하도록 확장
- Pad Options: 클리핑 방지를 위한 중앙 정렬 모달 시스템으로 전환

### Fixed
- `initSequencer` 시 메타데이터 필터링 및 초기 패턴 생성 오류 수정
- 모바일 브라우저의 passive listener 및 더블 트리거 이슈 해결

---

## [1.2.0] - 2026-01-19

### Added
- System 메뉴 내 개별 삭제(Clear) 기능 추가 (Sequence, Sound Kit, Project Song)
- 프로젝트 전체를 오디오로 믹스다운하는 **Render Audio (WAV)** 기능 추가
- 렌더링된 오디오를 파일로 저장하거나 현재 패드에 즉시 로드하는 기능 추가
- 렌더링 결과 미리보기 파형에 실시간 재생 바(Playhead) 및 시간 룰러(Ruler) 표시 추가
- 리스트 및 패널 영역 가독성 보장을 위한 스크롤바 레이아웃 일관성 (`scrollbar-gutter: stable`) 적용

### Changed
- SettingsMenu 레이아웃 개선: 모바일 Portrait 대응을 위한 가변 너비(`w-fit`) 적용
- 개별 삭제(Clear) 시 사용자 설정(BPM, Step Length) 보존 로직 적용

### Fixed
- 모바일 Portrait 모드에서 SettingsMenu 텍스트 줄바꿈 문제 수정

---

## [1.1.0] - 2026-01-18

### Added
- 64-step 시퀀스 모드 지원 (8x8 그리드)
- iOS Safari 오디오 재개 UI ("Tap to Resume")
- Factory Reset 기능

### Changed
- 패드 테두리 두께 개선 (모바일 최적화)
- 시퀀스 모드 패드 그리드 UI 개선

### Fixed
- Chop 재생 헤드 GATE/LOOP 모드 표시 문제
- 녹음 오디오 피치/길이 이상

---

## [1.0.0] - 2026-01-15

### Added
- 4채널 x 16 패드 시스템
- 16-step 시퀀서, GATE/ONE_SHOT/LOOP 트리거
- 파형 편집기, 파라미터 컨트롤
- 샘플 라이브러리, UltraSample 모드
- 프로젝트 저장/불러오기

---

**문서 관리자**: Development Team
