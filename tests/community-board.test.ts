import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import handler from '../netlify/functions/community.mts'
import type { CommunityPost } from '../shared/community-contract'

const TEST_PATH = 'http://localhost/api/community'
const VALID_PASSWORD = 'test-pass-2026'
let createdPost: CommunityPost | null = null

async function request(method: string, path: string, body?: unknown) {
  return handler(
    new Request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  )
}

describe('Community API', () => {
  beforeEach(async () => {
    const response = await request('GET', TEST_PATH)
    expect(response.status).toBe(200)
    const data = (await response.json()) as { posts: CommunityPost[] }
    expect(Array.isArray(data.posts)).toBe(true)
  })

  it('creates, updates, and deletes a post with password verification', async () => {
    const createResponse = await request('POST', TEST_PATH, {
      title: '테스트 게시글',
      content: '내용입니다.',
      password: VALID_PASSWORD,
    })

    expect(createResponse.status).toBe(201)
    const newPost = (await createResponse.json()) as CommunityPost
    expect(newPost.title).toBe('테스트 게시글')
    expect(newPost.content).toBe('내용입니다.')
    expect(newPost.id).toBeTruthy()
    createdPost = newPost

    const updateResponse = await request('PUT', `${TEST_PATH}/${encodeURIComponent(newPost.id)}`, {
      title: '수정된 제목',
      content: '수정된 내용입니다.',
      password: VALID_PASSWORD,
    })

    expect(updateResponse.status).toBe(200)
    const updatedPost = (await updateResponse.json()) as CommunityPost
    expect(updatedPost.title).toBe('수정된 제목')
    expect(updatedPost.content).toBe('수정된 내용입니다.')

    const deleteResponse = await request('DELETE', `${TEST_PATH}/${encodeURIComponent(newPost.id)}`, {
      password: VALID_PASSWORD,
    })

    expect(deleteResponse.status).toBe(200)
    const deleteBody = await deleteResponse.json()
    expect(deleteBody).toEqual({ success: true })
  })

  it('rejects invalid password for update and delete', async () => {
    const createResponse = await request('POST', TEST_PATH, {
      title: '비밀번호 검사 게시글',
      content: '테스트',
      password: VALID_PASSWORD,
    })
    const newPost = (await createResponse.json()) as CommunityPost

    const badUpdate = await request('PUT', `${TEST_PATH}/${encodeURIComponent(newPost.id)}`, {
      title: '실패',
      content: '실패',
      password: 'wrong',
    })
    expect(badUpdate.status).toBe(403)
    const badUpdateBody = await badUpdate.json()
    expect(badUpdateBody.code).toBe('INVALID_PASSWORD')

    const badDelete = await request('DELETE', `${TEST_PATH}/${encodeURIComponent(newPost.id)}`, {
      password: 'wrong',
    })
    expect(badDelete.status).toBe(403)
    const badDeleteBody = await badDelete.json()
    expect(badDeleteBody.code).toBe('INVALID_PASSWORD')

    await request('DELETE', `${TEST_PATH}/${encodeURIComponent(newPost.id)}`, {
      password: VALID_PASSWORD,
    })
  })
})
