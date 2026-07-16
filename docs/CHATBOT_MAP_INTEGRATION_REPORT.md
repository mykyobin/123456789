# 챗봇·지도 연동 구현 보고서

## 구현 내용

- 기존 챗봇과 지도 디자인을 유지했습니다.
- 챗봇이 위치가 포함된 축제 결과를 답변하면 해당 답변 하단에 `지도에서 보기` 버튼이 나타납니다.
- 지도는 답변만으로 자동 이동하지 않으며 사용자가 버튼을 눌렀을 때만 이동합니다.
- 모바일에서는 지도 버튼을 누르면 챗봇을 최소화한 뒤 지도 영역으로 이동합니다.
- 선택한 축제가 현재 지도 필터 결과에 없어도 기존 필터를 바꾸지 않고 임시 강조 마커로 표시합니다.
- 같은 축제를 다시 눌러도 지도 이동과 팝업 열기가 다시 실행됩니다.
- 채팅 입력창 아래에 연관·추천 질문 3개를 표시합니다.
- 검색 결과가 없거나 API 오류가 발생하면 `처음으로` 버튼을 표시합니다.
- `처음으로`는 채팅과 챗봇이 만든 지도 강조만 초기화하며 사용자가 설정한 지도 필터는 유지합니다.

## 주요 변경 파일

- `src/App.vue`
- `src/chatbot/FestivalChatWidget.vue`
- `src/features/map/FestivalMapSection.vue`
- `src/features/map/components/FestivalMap.vue`
- `src/features/map/types.ts`
- `shared/chat-contract.ts`
- `netlify/functions/chat.mts`
- `netlify/functions/_shared/suggested-questions.ts`
- `tests/chat-handler.test.ts`
- `tests/suggested-questions.test.ts`

## 검증 결과

- `npm test`: 6개 테스트 파일, 28개 테스트 통과
- `npm run typecheck`: 통과
- `npm run build`: 통과
- `npm run bundle:functions`: 통과

Vite 빌드에서 단일 JavaScript 청크가 500kB를 넘는다는 기존 성능 경고가 표시되지만 빌드 실패나 이번 기능의 오류는 아닙니다.
