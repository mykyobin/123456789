import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import type {
  ApiErrorBody,
  CommunityCreateRequest,
  CommunityDeleteRequest,
  CommunityPost,
  CommunityUpdateRequest,
} from '../../shared/community-contract'

const DATA_PATH = fileURLToPath(new URL('./data/community.json', import.meta.url))

interface StoredCommunityPost extends CommunityPost {
  passwordHash: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function errorResponse(message: string, status: number, code?: string): Response {
  const body: ApiErrorBody = { error: message, code }
  return json(body, status)
}

async function readPosts(): Promise<StoredCommunityPost[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8')
    return JSON.parse(raw) as StoredCommunityPost[]
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function writePosts(posts: StoredCommunityPost[]): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(posts, null, 2), 'utf-8')
}

const allowedCategories = ['general', 'party', 'review'] as const

type CommunityPostCategory = (typeof allowedCategories)[number]

function isValidCategory(value: unknown): value is CommunityPostCategory {
  return typeof value === 'string' && allowedCategories.includes(value as CommunityPostCategory)
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(digest)
}

function getIdFromPath(request: Request): string | null {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 3 && segments[1] === 'community') {
    return decodeURIComponent(segments[2])
  }
  return null
}

function validateCreateBody(value: unknown): value is CommunityCreateRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).title === 'string' &&
    typeof (value as any).content === 'string' &&
    typeof (value as any).password === 'string' &&
    ((value as any).category === undefined || isValidCategory((value as any).category)) &&
    ((value as any).festivalName === undefined || typeof (value as any).festivalName === 'string') &&
    ((value as any).partyDate === undefined || typeof (value as any).partyDate === 'string') &&
    ((value as any).rating === undefined || typeof (value as any).rating === 'number')
  )
}

function validateUpdateBody(value: unknown): value is CommunityUpdateRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).title === 'string' &&
    typeof (value as any).content === 'string' &&
    typeof (value as any).password === 'string' &&
    ((value as any).category === undefined || isValidCategory((value as any).category)) &&
    ((value as any).festivalName === undefined || typeof (value as any).festivalName === 'string') &&
    ((value as any).partyDate === undefined || typeof (value as any).partyDate === 'string') &&
    ((value as any).rating === undefined || typeof (value as any).rating === 'number')
  )
}

function validateDeleteBody(value: unknown): value is CommunityDeleteRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).password === 'string'
  )
}

function createPostId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const hasId = path.startsWith('/api/community/')
  const postId = hasId ? getIdFromPath(request) : null

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET, POST, PUT, DELETE, OPTIONS',
      },
    })
  }

  if (request.method === 'GET' && !hasId) {
    const posts = await readPosts()
    const publicPosts = posts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ passwordHash, ...rest }) => rest)
    return json({ posts: publicPosts })
  }

  if (request.method === 'POST' && !hasId) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('올바른 JSON 요청이 아닙니다.', 400, 'INVALID_JSON')
    }

    if (!validateCreateBody(body)) {
      return errorResponse('title, content, password를 모두 입력해 주세요.', 400, 'INVALID_REQUEST')
    }

    const trimmedTitle = body.title.trim()
    const trimmedContent = body.content.trim()
    const password = body.password
    const category = isValidCategory(body.category) ? body.category : 'general'
    const trimmedFestivalName = typeof body.festivalName === 'string' ? body.festivalName.trim() : ''
    const partyDate = typeof body.partyDate === 'string' ? body.partyDate.trim() : undefined
    const rating = typeof body.rating === 'number' ? body.rating : undefined

    if (!trimmedTitle) {
      return errorResponse('제목을 입력해 주세요.', 400, 'EMPTY_TITLE')
    }

    if (!trimmedContent) {
      return errorResponse('내용을 입력해 주세요.', 400, 'EMPTY_CONTENT')
    }

    if (!password) {
      return errorResponse('비밀번호를 입력해 주세요.', 400, 'EMPTY_PASSWORD')
    }

    if (category !== 'general' && !trimmedFestivalName) {
      return errorResponse('축제 이름을 입력해 주세요.', 400, 'EMPTY_FESTIVAL_NAME')
    }

    if (category === 'review' && (rating === undefined || rating < 1 || rating > 5)) {
      return errorResponse('1에서 5 사이의 평점을 입력해 주세요.', 400, 'INVALID_RATING')
    }

    const posts = await readPosts()
    const now = new Date().toISOString()
    const newPost: StoredCommunityPost = {
      id: createPostId(),
      title: trimmedTitle,
      content: trimmedContent,
      category,
      festivalName: trimmedFestivalName || undefined,
      partyDate: category === 'party' ? partyDate : undefined,
      rating: category === 'review' ? rating : undefined,
      createdAt: now,
      updatedAt: now,
      passwordHash: await hashPassword(password),
    }

    await writePosts([newPost, ...posts])
    const { passwordHash, ...publicPost } = newPost
    return json(publicPost, 201)
  }

  if ((request.method === 'PUT' || request.method === 'DELETE') && postId) {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('올바른 JSON 요청이 아닙니다.', 400, 'INVALID_JSON')
    }

    const posts = await readPosts()
    const existingIndex = posts.findIndex((post) => post.id === postId)
    if (existingIndex === -1) {
      return errorResponse('해당 게시글을 찾을 수 없습니다.', 404, 'NOT_FOUND')
    }

    const existingPost = posts[existingIndex]

    if (!validateDeleteBody(body)) {
      return errorResponse('password가 필요합니다.', 400, 'INVALID_REQUEST')
    }

    const passwordMatches = (await hashPassword(body.password)) === existingPost.passwordHash
    if (!passwordMatches) {
      return errorResponse('비밀번호가 일치하지 않습니다.', 403, 'INVALID_PASSWORD')
    }

    if (request.method === 'DELETE') {
      const updatedPosts = posts.filter((post) => post.id !== postId)
      await writePosts(updatedPosts)
      return json({ success: true })
    }

    if (!validateUpdateBody(body)) {
      return errorResponse('title, content, password를 모두 입력해 주세요.', 400, 'INVALID_REQUEST')
    }

    const trimmedTitle = body.title.trim()
    const trimmedContent = body.content.trim()
    const category = isValidCategory(body.category) ? body.category : existingPost.category
    const trimmedFestivalName = typeof body.festivalName === 'string' ? body.festivalName.trim() : existingPost.festivalName
    const partyDate = typeof body.partyDate === 'string' ? body.partyDate.trim() : existingPost.partyDate
    const rating = typeof body.rating === 'number' ? body.rating : existingPost.rating

    if (!trimmedTitle) {
      return errorResponse('제목을 입력해 주세요.', 400, 'EMPTY_TITLE')
    }
    if (!trimmedContent) {
      return errorResponse('내용을 입력해 주세요.', 400, 'EMPTY_CONTENT')
    }

    if (category !== 'general' && !trimmedFestivalName) {
      return errorResponse('축제 이름을 입력해 주세요.', 400, 'EMPTY_FESTIVAL_NAME')
    }

    if (category === 'review' && (rating === undefined || rating < 1 || rating > 5)) {
      return errorResponse('1에서 5 사이의 평점을 입력해 주세요.', 400, 'INVALID_RATING')
    }

    const now = new Date().toISOString()
    const updatedPost: StoredCommunityPost = {
      ...existingPost,
      title: trimmedTitle,
      content: trimmedContent,
      category,
      festivalName: trimmedFestivalName || undefined,
      partyDate: category === 'party' ? partyDate : undefined,
      rating: category === 'review' ? rating : undefined,
      updatedAt: now,
    }

    posts[existingIndex] = updatedPost
    await writePosts(posts)
    const { passwordHash, ...publicPost } = updatedPost
    return json(publicPost)
  }

  return errorResponse('지원하지 않는 요청입니다.', 405, 'METHOD_NOT_ALLOWED')
}
