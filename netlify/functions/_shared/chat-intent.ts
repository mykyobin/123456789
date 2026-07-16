import type { ChatHistoryMessage } from '../../../shared/chat-contract'

export type ChatIntent = 'conversation' | 'festival'

const FESTIVAL_KEYWORDS = [
  '축제',
  '공연',
  '행사',
  '페스티벌',
  '콘서트',
  '전시',
  '박람회',
  '문화행사',
  '공공데이터',
]

const FESTIVAL_DETAIL_KEYWORDS = [
  '일정',
  '기간',
  '날짜',
  '언제',
  '장소',
  '위치',
  '주소',
  '좌표',
  '요금',
  '가격',
  '무료',
  '시간',
  '전화',
  '연락처',
  '관람',
  '프로그램',
]

const SMALL_TALK_PATTERNS = [
  /^(안녕|안녕하세요|ㅎㅇ|하이|hello|hi)[!?.\s]*$/i,
  /^(고마워|고맙습니다|감사해|감사합니다|thanks|thank you)[!?.\s]*$/i,
  /^(잘가|다음에 봐|bye)[!?.\s]*$/i,
  /^(너는?\s*)?(누구야|누구세요|정체가 뭐야)[!?.\s]*$/i,
  /^(뭐 할 수 있어|무엇을 할 수 있어|도움말|사용법)[!?.\s]*$/i,
]

const FOLLOW_UP_PATTERN = /^(그거|그건|그 행사|그 축제|이거|이건|거기|그러면|그럼)?\s*(요금|가격|무료|언제|일정|기간|시간|어디|장소|위치|주소|좌표|전화|연락처|자세히|정보)/i

function normalized(value: string): string {
  return value.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim()
}

export function isSimpleConversation(question: string): boolean {
  const value = normalized(question)
  return SMALL_TALK_PATTERNS.some((pattern) => pattern.test(value))
}

export function hasFestivalKeyword(text: string): boolean {
  const value = normalized(text)
  return FESTIVAL_KEYWORDS.some((keyword) => value.includes(keyword))
}

export function isFestivalFollowUp(question: string): boolean {
  const value = normalized(question)
  return FOLLOW_UP_PATTERN.test(value) || FESTIVAL_DETAIL_KEYWORDS.some((keyword) => value === keyword)
}

export function lastUserMessage(history: readonly ChatHistoryMessage[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message?.role === 'user' && message.content.trim()) {
      return message.content.trim()
    }
  }
  return null
}

export function historyHasFestivalContext(
  history: readonly ChatHistoryMessage[],
): boolean {
  return history.slice(-6).some((message) => hasFestivalKeyword(message.content))
}

export function detectChatIntent(options: {
  question: string
  history: readonly ChatHistoryMessage[]
  directResultCount: number
  previousResultCount?: number
}): ChatIntent {
  const { question, history, directResultCount, previousResultCount = 0 } = options

  // 인사나 자기소개 같은 짧은 대화는 검색 결과와 무관하게 일반 대화로 처리한다.
  if (isSimpleConversation(question)) return 'conversation'

  if (hasFestivalKeyword(question)) return 'festival'

  // '요금은 얼마야?'처럼 대상이 없는 상세 질문은 우연한 문자열 일치로
  // 행사 검색으로 넘어가지 않도록, 이전 축제 맥락이 있을 때만 축제로 본다.
  if (isFestivalFollowUp(question)) {
    return historyHasFestivalContext(history) || previousResultCount > 0
      ? 'festival'
      : 'conversation'
  }

  if (directResultCount > 0) return 'festival'

  return 'conversation'
}
