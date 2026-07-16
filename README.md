# 서울 축제 ChatLLM 웹사이트

이 프로젝트는 서울 축제·공연·행사 정보를 보여주는 Vue 3 웹사이트입니다. 메인 페이지는 데모 형식으로 구성되어 있으며, 축제 지도와 커뮤니티 게시판, 그리고 자연어 검색 챗봇을 한 화면에서 제공합니다.

![챗봇 열린 화면](docs/screenshots/chatbot-open.png)

## 웹사이트 주요 기능

- 데모 랜딩 페이지: 서울 지역 정보 서비스를 소개하는 히어로 섹션과 페이지 구성
- 축제 지도 섹션: `FestivalMapSection`을 통해 서울 축제를 시각적으로 탐색
- 커뮤니티 게시판: `CommunityBoard`를 통해 사용자 게시글과 지역 소식을 확인
- 채팅형 검색 위젯: 화면 우측 하단 플로팅 아이콘을 눌러 대화형 챗봇 사용
- 모바일 대응: 작은 화면에서는 챗봇이 전체 화면으로 확장되어 편리하게 사용
- 빠른 질문 버튼: 자주 쓰는 질문을 바로 선택해 조회
- 대화형 검색: 질문과 대화 내역을 바탕으로 축제 정보를 응답

## 사용자가 보는 화면

1. 웹사이트에 접속하면 서울 테마의 히어로 섹션과 함께 축제 정보 홍보 요소가 보입니다.
2. 아래로 스크롤하면 축제 지도 섹션과 커뮤니티 게시판이 이어집니다.
3. 우측 하단 챗봇 아이콘을 클릭하면 상담형 대화창이 열립니다.
4. 사용자는 자연어로 질문을 입력할 수 있습니다.
   - 예: “오늘 서울에서 무료 축제 알려줘”
   - 예: “종로구에서 이번 주말 공연 있어?”
   - 예: “내일 열리는 축제 일정이 뭐야?”
5. 챗봇 답변과 함께 관련 축제 정보가 나타납니다.

## 챗봇의 동작 방식

- 브라우저에서 `/api/chat`로 POST 요청을 보냅니다.
- 서버는 질문을 검증하고 로컬 축제 데이터를 검색합니다.
- 검색 결과 중 최대 5건을 선택합니다.
- OpenAI API 키가 설정되어 있으면 선택된 결과를 OpenAI Responses API에 전달해 자연어 답변을 생성합니다.
- 키가 없거나 OpenAI 호출이 실패하면, 로컬 데이터 기반의 안전한 폴백 응답을 반환합니다.

## 데이터 출처

웹사이트는 로컬 JSON 형태의 서울 축제·공연·행사 데이터를 사용합니다.

- `netlify/functions/data/seoul-festivals.json`
- `netlify/functions/data/서울_관광지.json`
- `netlify/functions/data/서울_숙박.json`
- `netlify/functions/data/서울_쇼핑.json`
- `netlify/functions/data/서울_문화시설.json`
- `netlify/functions/data/서울_레포츠.json`
- `netlify/functions/data/서울_여행코스.json`

이 데이터는 공공 관광 데이터를 기반으로 하며, 검색과 폴백 응답 품질을 위해 사용됩니다.

## 웹사이트 구조

- `src/App.vue` - 데모 페이지 전체 레이아웃과 챗봇 위젯 배치
- `src/chatbot/` - 챗봇 UI 컴포넌트, API 클라이언트, 타입 정의
- `shared/chat-contract.ts` - 브라우저와 Netlify Function 간의 요청/응답 타입 공유
- `netlify/functions/chat.mts` - `/api/chat` 엔드포인트 구현
- `netlify/functions/_shared/` - 검색 로직, 의도 감지, 폴백 답변 생성
- `netlify/functions/data/` - 서울 축제 및 커뮤니티 샘플 JSON 데이터

## 설치 및 실행 방법

### 요구 사항

- Node.js 22 이상
- npm

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:5173
```

챗봇을 바로 열려면:

```text
http://localhost:5173/?chat=open
```

## 환경 변수 설정

루트 폴더에서 `.env.example`을 복사하여 `.env` 파일을 생성합니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

`.env` 예시:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
CHATBOT_FORCE_FALLBACK=false
```

> OpenAI API 키는 Netlify Function에서만 사용하므로 `VITE_` 접두사를 붙이지 마세요.

변경 후에는 개발 서버를 재시작합니다.

```bash
npm run dev
```

## 테스트 및 검증

- `npm test` - Vitest 단위 테스트 실행
- `npm run typecheck` - TypeScript 검증
- `npm run build` - 프로덕션 빌드
- `npm run bundle:functions` - Netlify Function 번들 생성
- `npm run check` - 테스트, 빌드, 함수 번들을 순차 실행

## Netlify 배포

`netlify.toml`에는 Netlify 배포를 위한 설정이 이미 포함되어 있습니다.

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "22"

[functions]
  node_bundler = "esbuild"
```

배포 시 설정할 환경 변수:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CHATBOT_FORCE_FALLBACK`

## 통합 및 확장

챗봇 위젯은 Vue Router나 글로벌 상태에 의존하지 않도록 설계되었습니다. 다른 Vue 3 앱에 쉽게 임베드할 수 있으며, `Teleport`를 사용해 `body` 아래에 렌더링합니다.

기존 사이트에 통합할 때 참조할 파일:

- `src/chatbot/`
- `shared/chat-contract.ts`
- `netlify/functions/chat.mts`
- `netlify/functions/_shared/`
- `netlify/functions/data/seoul-festivals.json`

필요한 추가 패키지:

```bash
npm install openai @netlify/functions
```

## 주의 사항

- OpenAI API 키를 브라우저로 노출하지 마세요.
- `.env` 파일은 버전 관리에서 제외되어야 합니다.
- 질문은 최대 300자까지 허용됩니다.
- IP당 분당 10회 요청 제한이 적용됩니다.

## 참고 문서

- `docs/ARCHITECTURE.md` - 아키텍처 설계
- `docs/SETUP_FOR_BEGINNERS.md` - 초보자 실행 가이드
- `docs/VERIFICATION_REPORT.md` - 검증 보고서
- `docs/INTEGRATION.md` - 통합 가이드

## 데이터 라이선스

이 프로젝트는 한국관광공사의 공공 데이터를 활용하며, 관련 데이터 라이선스 정책을 따릅니다.


```vue
<script setup lang="ts">
import { FestivalChatWidget } from '@/chatbot'
</script>

<template>
  <RouterView />

  <FestivalChatWidget
    title="서울 축제 ChatLLM"
    subtitle="공공데이터 기반 상담 챗봇"
    api-endpoint="/api/chat"
    primary-color="#3165ff"
    :z-index="1200"
  />
</template>
```

이 위젯은 Vue Router, Pinia, 전역 상태, 외부 CSS 프레임워크에 의존하지 않습니다. `Teleport`로 `body` 아래에 렌더링되고 스타일은 `scoped`이므로 기존 레이아웃에 의해 잘릴 가능성을 줄였습니다.

자세한 충돌 점검은 [기존 사이트 통합 가이드](docs/INTEGRATION_GUIDE.md)를 확인합니다.

## 8. 주요 폴더

```text
src/chatbot/                         독립형 챗봇 UI 모듈
shared/chat-contract.ts              프론트·Function 공용 요청/응답 타입
netlify/functions/chat.mts           HTTP 검증 + OpenAI 호출
netlify/functions/_shared/            데이터 검색·안전 답변 모듈
netlify/functions/data/               원본 서울 축제 JSON
vite-plugins/local-netlify-function.ts 로컬 개발용 Function 어댑터
tests/                                검색·Function 테스트
docs/                                 설정·통합·아키텍처 문서
```

## 9. 데이터 출처와 라이선스

이 프로젝트는 한국관광공사 TourAPI 4.0의 서울 축제·공연·행사 데이터를 사용합니다.

- 제공 기관: 한국관광공사
- 데이터: 국문 관광정보 서비스, 서울 축제공연행사 201건
- 라이선스: 공공누리 제3유형
- 조건: 출처 표시, 원본 데이터 변경 금지
- 원본 안내: `https://www.data.go.kr/data/15101578/openapi.do`

원본 JSON의 값은 수정하지 않고 파일명만 프로젝트 친화적으로 변경했습니다.

## 10. 현재 한계

- 검색은 정형 필드와 키워드·조건 기반이며 벡터 검색이 아닙니다.
- 후속 질문 문맥을 서버에 전달하지 않습니다.
- JSON 수집 시점 이후의 변경 사항은 자동 반영되지 않습니다.
- 기존 실제 사이트 소스가 제공되지 않았으므로 구조적 통합 검토까지 완료했으며, 실제 CSS·경로 충돌은 합칠 대상 저장소에서 최종 확인해야 합니다.

## 11. GitHub에 올리기

자세한 화면·명령 절차는 [GitHub 업로드 가이드](docs/GITHUB_UPLOAD.md)를 확인합니다.


새 빈 저장소 이름을 `seoul-festival-chatbot-mvp`로 만든 다음 프로젝트 루트에서 실행합니다.

```bash
git init
git branch -M main
git add .
git commit -m "feat: add Seoul festival ChatLLM MVP"
git remote add origin https://github.com/lmg3111977/seoul-festival-chatbot-mvp.git
git push -u origin main
```

실제 `.env`가 커밋되지 않았는지 반드시 확인합니다.

```bash
git status
git ls-files .env
```

두 번째 명령이 아무것도 출력하지 않아야 정상입니다.
