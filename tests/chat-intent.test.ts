import { describe, expect, it } from 'vitest'
import {
  detectChatIntent,
  isFestivalFollowUp,
} from '../netlify/functions/_shared/chat-intent'

describe('챗봇 질문 분류', () => {
  it('인사와 자기소개를 일반 대화로 분류한다', () => {
    expect(
      detectChatIntent({ question: '안녕', history: [], directResultCount: 0 }),
    ).toBe('conversation')
    expect(
      detectChatIntent({ question: '너 누구야?', history: [], directResultCount: 0 }),
    ).toBe('conversation')
  })

  it('축제 키워드와 실제 검색 결과를 축제 질문으로 분류한다', () => {
    expect(
      detectChatIntent({
        question: '종로구 무료 축제 알려줘',
        history: [],
        directResultCount: 2,
      }),
    ).toBe('festival')

    expect(
      detectChatIntent({
        question: '문학주간 2026 알려줘',
        history: [],
        directResultCount: 1,
      }),
    ).toBe('festival')
  })

  it('축제 대화 이후의 짧은 후속 질문을 축제 질문으로 분류한다', () => {
    expect(isFestivalFollowUp('그거 요금은?')).toBe(true)
    expect(
      detectChatIntent({
        question: '그거 요금은?',
        history: [
          { role: 'user', content: '문학주간 축제 알려줘' },
          { role: 'assistant', content: '문학주간 정보를 안내했습니다.' },
        ],
        directResultCount: 0,
      }),
    ).toBe('festival')
  })
})
