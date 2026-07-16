# 커뮤니티 기능 버그 점검 및 수정 보고서

## 결론

커뮤니티 CRUD는 서버 파일과 브라우저 localStorage를 혼합해서 사용하고 있었습니다. 이 방식은 로컬 개발에서는 일부 동작하는 것처럼 보여도 Netlify 배포 후 게시글이 저장되지 않거나, 등록 직후 보이던 글이 새로고침 후 사라질 수 있습니다.

프로젝트 요구사항인 `게시글 localStorage 저장`에 맞춰 커뮤니티 저장 방식을 브라우저 localStorage 하나로 통일했습니다.

## 발견한 주요 버그

### 1. Netlify Function의 JSON 파일 쓰기는 영구 저장 방식이 아님

- 기존 `netlify/functions/community.mts`는 배포 묶음 안의 `community.json`을 `fs.writeFile()`로 수정했습니다.
- Netlify Function 실행 파일 시스템은 게시판 데이터베이스처럼 영구 저장하는 용도로 사용할 수 없습니다.
- 결과적으로 배포 환경에서 등록·수정·삭제가 실패하거나 다음 실행에서 데이터가 사라질 수 있었습니다.

### 2. `/api/community` 라우팅이 실제 Function과 연결되지 않음

- 챗봇 Function에는 `/api/chat` 경로 설정이 있었지만 커뮤니티 Function에는 `/api/community` 경로 설정이 없었습니다.
- 요청이 HTML을 반환하면 JSON 파싱 오류가 발생하고, 화면에 오류가 표시될 수 있었습니다.

### 3. 서버와 localStorage 데이터가 서로 달라지는 문제

- 등록 실패 시에는 localStorage에 저장하면서 목록 조회는 다시 서버에서 시도했습니다.
- 등록 직후에는 글이 보이지만 새로고침하면 서버의 빈 목록이 표시되어 글이 사라진 것처럼 보일 수 있었습니다.
- 서버 게시글과 로컬 게시글의 ID가 섞이면 수정·삭제 대상도 찾지 못할 수 있었습니다.

### 4. 모든 API 오류를 localStorage 저장으로 처리

- 잘못된 비밀번호, 잘못된 입력, 게시글 없음 같은 정상적인 4xx 오류도 모두 서버 장애처럼 취급했습니다.
- 오류 원인이 가려지고 저장소 상태가 더 복잡해질 수 있었습니다.

### 5. 카테고리 변경 후 이전 전용 정보가 남음

- 리뷰를 일반 글로 변경해도 기존 `festivalName`, `rating` 값이 localStorage에 남았습니다.
- 파티 모집을 일반 글로 바꿔도 기존 동행 날짜가 남을 수 있었습니다.

### 6. 손상된 localStorage 데이터 검증 부족

- 저장된 JSON을 타입 확인 없이 바로 사용했습니다.
- 잘못된 값이나 손상된 JSON이 들어오면 게시판 로딩·수정 과정에서 예외가 발생할 수 있었습니다.

## 적용한 수정

- 커뮤니티 CRUD를 localStorage 단일 저장 방식으로 변경
- 사용하지 않는 `netlify/functions/community.mts`와 `community.json` 제거
- 제목, 내용, 비밀번호, 카테고리, 축제명, 평점 검증 추가
- 비밀번호 해시가 화면 응답에 포함되지 않도록 유지
- 잘못된 비밀번호의 수정·삭제 차단
- 카테고리 변경 시 관련 없는 축제명·동행 날짜·평점 제거
- 손상된 localStorage 원본을 `community-posts-corrupted-backup`에 백업한 뒤 게시판 복구
- 다른 탭에서 커뮤니티 데이터가 변경되면 현재 탭 목록도 다시 불러오도록 `storage` 이벤트 처리
- 수정창과 삭제창이 동시에 열리지 않도록 개선
- 저장 위치가 현재 브라우저라는 안내 문구 추가
- 오류·성공 메시지에 접근성 역할 추가
- 커뮤니티 메타 정보 스타일 보완

## 변경 파일

- `src/community/api.ts`
- `src/components/CommunityBoard.vue`
- `tests/community-board.test.ts`
- `shared/community-contract.ts`
- `docs/COMMUNITY_FIX_REPORT.md`

삭제 파일:

- `netlify/functions/community.mts`
- `netlify/functions/data/community.json`

## 검증 결과

- 전체 테스트: 24개 통과
- 커뮤니티 테스트: 5개 시나리오 통과
  - 등록 및 새로고침용 재조회
  - 비밀번호 검증 수정·삭제
  - 카테고리 변경 시 전용 필드 제거
  - 잘못된 리뷰 평점 차단
  - 손상된 localStorage 백업 및 복구
- TypeScript/Vue 타입 검사 통과
- Vite 프로덕션 빌드 통과
- Netlify 챗봇 Function 번들 통과
- npm 보안 감사: 취약점 0개

## 저장 방식의 제한

localStorage 방식은 과제 요구사항에는 맞지만 게시글이 사용자별 브라우저에만 저장됩니다.

- 다른 컴퓨터·브라우저·휴대폰과 공유되지 않음
- 브라우저 데이터 삭제 시 게시글도 삭제됨
- 여러 사용자가 같은 게시판을 공유하는 실제 서비스에는 데이터베이스가 필요함

현재 MVP 범위에서는 별도 백엔드나 DB 없이 안정적으로 동작하도록 localStorage 방식을 유지했습니다.

## 수동 확인 순서

1. `npm install`
2. `npm run dev`
3. 일반 글 등록 후 새로고침해 글이 유지되는지 확인
4. 틀린 비밀번호로 수정·삭제가 거부되는지 확인
5. 맞는 비밀번호로 수정·삭제되는지 확인
6. 리뷰 글을 일반 글로 변경한 뒤 축제명과 평점이 표시되지 않는지 확인
7. Netlify 배포 후에도 같은 브라우저에서 등록·새로고침이 정상인지 확인
