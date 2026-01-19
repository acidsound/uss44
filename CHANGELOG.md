# 📋 USS44 변경 이력 (Changelog)

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)

---

## [Unreleased]

---

## [1.2.0] - 2026-01-19

### Added
- System 메뉴 내 개별 삭제(Clear) 기능 추가 (Sequence, Sound Kit, Project Song)
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
