import { describe, expect, it } from 'vitest'
import {
  festivalDataMeta,
  festivals,
} from '../netlify/functions/_shared/festival-data'

describe('서울 축제 데이터 무결성', () => {
  it('서울 축제공연행사 201건을 전부 적재한다', () => {
    expect(festivalDataMeta).toMatchObject({
      region: '서울',
      contentType: '축제공연행사',
      total: 201,
    })
    expect(festivals).toHaveLength(201)
  })

  it('모든 항목에 검색 필수 식별 정보가 있다', () => {
    expect(
      festivals.every(
        (festival) =>
          festival.contentid?.trim() &&
          festival.title?.trim() &&
          festival.addr1?.trim(),
      ),
    ).toBe(true)
  })
})
