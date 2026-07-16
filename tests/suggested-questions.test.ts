import { describe, expect, it } from 'vitest'
import type { FestivalSource } from '../shared/chat-contract'
import {
  createSuggestedQuestions,
  DEFAULT_SUGGESTED_QUESTIONS,
} from '../netlify/functions/_shared/suggested-questions'

const source: FestivalSource = {
  contentId: '1',
  title: '테스트 축제',
  address: '서울특별시 종로구',
  eventPlace: '테스트 광장',
  startDate: '2026-07-16',
  endDate: '2026-07-17',
  playTime: null,
  fee: '무료',
  ageLimit: null,
  phone: null,
  imageUrl: null,
  longitude: 126.98,
  latitude: 37.57,
  status: 'ongoing',
  programExcerpt: null,
}

describe('연관 추천 질문 생성', () => {
  it('일반 대화에는 기본 질문 3개를 제공한다', () => {
    expect(createSuggestedQuestions('conversation', [])).toEqual([
      ...DEFAULT_SUGGESTED_QUESTIONS,
    ])
  })

  it('검색 결과가 없으면 다시 검색하기 쉬운 질문을 제공한다', () => {
    const questions = createSuggestedQuestions('festival', [])

    expect(questions).toHaveLength(3)
    expect(new Set(questions).size).toBe(3)
  })

  it('축제 한 건에는 해당 축제명 기반 질문을 제공한다', () => {
    const questions = createSuggestedQuestions('festival', [source])

    expect(questions).toHaveLength(3)
    expect(questions.every((question) => question.includes(source.title))).toBe(true)
  })
})
