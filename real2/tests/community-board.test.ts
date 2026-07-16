import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMMUNITY_STORAGE_KEY,
  CommunityApiError,
  createCommunityPost,
  deleteCommunityPost,
  loadLocalCommunityPosts,
  updateCommunityPost,
} from '../src/community/api'

const VALID_PASSWORD = 'test-pass-2026'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value))
  }
}

function setStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

beforeEach(() => {
  setStorage(new MemoryStorage())
})

describe('Community localStorage CRUD', () => {
  it('creates a post, persists it, and never exposes the password hash', async () => {
    const created = await createCommunityPost({
      title: ' 테스트 게시글 ',
      content: ' 내용입니다. ',
      password: VALID_PASSWORD,
      category: 'general',
    })

    expect(created.title).toBe('테스트 게시글')
    expect(created.content).toBe('내용입니다.')
    expect(created.category).toBe('general')
    expect(created).not.toHaveProperty('passwordHash')

    const reloaded = loadLocalCommunityPosts()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0]).toEqual(created)

    const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY) ?? ''
    expect(raw).not.toContain(VALID_PASSWORD)
    expect(raw).toContain('passwordHash')
  })

  it('updates and deletes only when the password matches', async () => {
    const created = await createCommunityPost({
      title: '원래 제목',
      content: '원래 내용',
      password: VALID_PASSWORD,
      category: 'party',
      festivalName: '서울 축제',
      partyDate: '2026-08-15',
    })

    await expect(
      updateCommunityPost(created.id, {
        title: '수정 실패',
        content: '수정 실패',
        password: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD', status: 403 })

    const updated = await updateCommunityPost(created.id, {
      title: '수정된 제목',
      content: '수정된 내용',
      password: VALID_PASSWORD,
      category: 'party',
      festivalName: '서울 축제',
      partyDate: '2026-08-16',
    })
    expect(updated.title).toBe('수정된 제목')
    expect(updated.partyDate).toBe('2026-08-16')

    await expect(
      deleteCommunityPost(created.id, { password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD', status: 403 })

    await deleteCommunityPost(created.id, { password: VALID_PASSWORD })
    expect(loadLocalCommunityPosts()).toEqual([])
  })

  it('clears category-only fields when a review is changed to a general post', async () => {
    const review = await createCommunityPost({
      title: '축제 후기',
      content: '재미있었습니다.',
      password: VALID_PASSWORD,
      category: 'review',
      festivalName: '서울 축제',
      rating: 5,
    })

    const updated = await updateCommunityPost(review.id, {
      title: '일반 글로 변경',
      content: '카테고리를 변경했습니다.',
      password: VALID_PASSWORD,
      category: 'general',
    })

    expect(updated.category).toBe('general')
    expect(updated.festivalName).toBeUndefined()
    expect(updated.partyDate).toBeUndefined()
    expect(updated.rating).toBeUndefined()
  })

  it('rejects an invalid review before writing it to storage', async () => {
    await expect(
      createCommunityPost({
        title: '평점 오류',
        content: '평점이 범위를 벗어났습니다.',
        password: VALID_PASSWORD,
        category: 'review',
        festivalName: '서울 축제',
        rating: 6,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CommunityApiError>>({
        code: 'INVALID_RATING',
        status: 400,
      }),
    )
    expect(localStorage.getItem(COMMUNITY_STORAGE_KEY)).toBeNull()
  })

  it('backs up malformed localStorage data and recovers with an empty board', () => {
    const broken = '{not-valid-json'
    localStorage.setItem(COMMUNITY_STORAGE_KEY, broken)

    expect(loadLocalCommunityPosts()).toEqual([])
    expect(localStorage.getItem(COMMUNITY_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('community-posts-corrupted-backup')).toBe(broken)
  })
})
