import type {
  ChatIntent,
  FestivalSource,
} from '../../../shared/chat-contract'

export const DEFAULT_SUGGESTED_QUESTIONS = [
  '오늘 진행 중인 축제 알려줘',
  '이번 달 무료 축제 알려줘',
  '종로구 축제 찾아줘',
] as const

const RECOVERY_SUGGESTED_QUESTIONS = [
  '이번 달 서울 축제 알려줘',
  '종로구에서 열리는 축제 찾아줘',
  '무료로 볼 수 있는 행사 알려줘',
] as const

function uniqueQuestions(questions: readonly string[]): string[] {
  return [...new Set(questions.map((question) => question.trim()).filter(Boolean))].slice(0, 3)
}

export function createSuggestedQuestions(
  intent: ChatIntent,
  sources: readonly FestivalSource[],
): string[] {
  if (intent === 'conversation') {
    return [...DEFAULT_SUGGESTED_QUESTIONS]
  }

  if (sources.length === 0) {
    return [...RECOVERY_SUGGESTED_QUESTIONS]
  }

  if (sources.length === 1) {
    const title = sources[0]?.title ?? '이 축제'

    return uniqueQuestions([
      `${title} 요금은 얼마야?`,
      `${title} 정확한 장소를 알려줘`,
      `${title} 근처 다른 축제도 알려줘`,
    ])
  }

  return uniqueQuestions([
    '이 중 무료 행사는 어떤 거야?',
    '이번 주말에 갈 수 있는 행사만 알려줘',
    '지역별로 다시 추천해줘',
  ])
}
