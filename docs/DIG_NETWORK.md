# 🎧 Dig Network - Social Media Audio Extraction

## ✅ 구현 완료

### Frontend
- **URL Parser** (`utils/urlParser.ts`): YouTube, TikTok, Instagram, 小红书, Rutube URL 자동 감지
- **oEmbed Service** (`services/oembedService.ts`): noembed.com + 플랫폼 네이티브 API로 썸네일/제목 미리보기
- **Dig Service** (`services/digService.ts`): 백엔드 API 연동, 검색(`searchVideos`), 추출 진행률 표시
- **DigNetwork Component** (`components/DigNetwork.tsx`): 통합 UI, 비디오 플레이어(YouTube/Rutube API 동기화), 검색 결과 리스트

### Backend (`backend/`)
- **Express Server** (`server.js`): yt-dlp 래퍼 API
- **Dockerfile**: Hugging Face Spaces 배포용 (Docker SDK)
- **Endpoints**:
  - `GET /health` - 서버 상태
  - `GET /platforms` - 지원 플랫폼 목록
  - `POST /info` - 영상 메타데이터 조회
  - `POST /search` - 동영상 검색 (YouTube search fallback)
  - `POST /extract` - 오디오 구간 추출 (3분 제한)

## 🚀 실행 방법

### 1. 백엔드 서버 실행
```bash
# 터미널 1
npm run backend
```

### 2. 프론트엔드 실행
```bash
# 터미널 2 (이미 실행 중이라면 필요 없음)
npm run dev
```

### 3. 동시 실행
```bash
npm run dev:all
```

## 🧪 백엔드 테스트 완료

### Rutube ✅
```bash
curl -X POST http://localhost:3001/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://rutube.ru/video/70cfcc5360d452d99268cbb83e5c35b0/"}'
```

### YouTube ✅
```bash
curl -X POST http://localhost:3001/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Search ✅
```bash
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "lofi beats"}'
```

## 📱 사용법

1. **Dig Library** 버튼 클릭
2. **Dig Network** 탭 선택
3. **URL 붙여넣기** 또는 **검색어 입력**:
   - YouTube/TikTok/Instagram/Rutube URL을 붙여넣으면 즉시 플레이어가 나타납니다.
   - 검색어를 입력하면 동영상 목록이 나타납니다.
4. **구간 선택 (Range Selection)**:
   - 플레이어 하단의 **"▶ Set Start"**, **"■ Set End"** 버튼을 사용하여 재생 중인 영상의 현재 시간을 정확히 캡처할 수 있습니다.
   - 타임라인 슬라이더를 직접 조절할 수도 있습니다. (최대 3분)
5. 미리보기 확인 후 **"Dig to Pad X"** 클릭
6. 추출된 오디오가 선택된 Pad에 로드됨

## 🔧 Hugging Face Spaces 배포

```bash
cd backend
# HuggingFace CLI로 Space 생성 후 (Docker SDK 선택)
git init
git add .
git commit -m "Initial commit"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/uss44-dig
git push -u origin main
```

배포 후 `.env.local` 또는 Production 환경 변수에 추가:
```
VITE_DIG_BACKEND_URL=https://YOUR_USERNAME-uss44-dig.hf.space
```

## 📋 남은 작업

- [ ] TikTok 테스트
- [ ] Instagram 테스트 (로그인 필요할 수 있음)
- [ ] 小红书 테스트
- [ ] 히스토리 영구 저장 (현재는 세션 내 유지)
- [ ] Hugging Face 실제 배포 및 연결 확인
- [ ] `yt-dlp` 최신 버전 유지 자동화
