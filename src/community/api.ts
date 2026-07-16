import type {
  ApiErrorBody,
  CommunityCreateRequest,
  CommunityDeleteRequest,
  CommunityPost,
  CommunityUpdateRequest,
} from '../../shared/community-contract'

export class CommunityApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'CommunityApiError'
    this.status = status
    this.code = code
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function handleError(response: Response): Promise<never> {
  const body = (await parseResponse(response)) as ApiErrorBody | null
  const message = body?.error ?? '커뮤니티 서버에 요청하지 못했습니다.'
  const code = body?.code
  throw new CommunityApiError(message, response.status, code)
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    await handleError(response)
  }

  return (await response.json()) as T
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

const LOCAL_STORAGE_KEY = 'community-posts'

interface StoredCommunityPost extends CommunityPost {
  passwordHash: string
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function loadLocalStoragePosts(): StoredCommunityPost[] {
  if (!isLocalStorageAvailable()) {
    return []
  }

  const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!stored) {
    return []
  }

  try {
    return JSON.parse(stored) as StoredCommunityPost[]
  } catch {
    return []
  }
}

function saveLocalStoragePosts(posts: StoredCommunityPost[]): void {
  if (!isLocalStorageAvailable()) {
    return
  }
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(posts))
}

function createLocalId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function canUseLocalFallback(error: unknown): boolean {
  if (error instanceof CommunityApiError) {
    return error.status >= 500
  }

  return error instanceof TypeError
}

async function createLocalCommunityPost(body: CommunityCreateRequest): Promise<CommunityPost> {
  const now = new Date().toISOString()
  const passwordHash = await hashPassword(body.password)
  const newPost: StoredCommunityPost = {
    id: createLocalId(),
    title: body.title.trim(),
    content: body.content.trim(),
    category: body.category ?? 'general',
    festivalName: body.festivalName?.trim() || undefined,
    partyDate: body.partyDate || undefined,
    rating: body.rating,
    createdAt: now,
    updatedAt: now,
    passwordHash,
  }

  const posts = loadLocalStoragePosts()
  saveLocalStoragePosts([newPost, ...posts])
  const { passwordHash: _, ...publicPost } = newPost
  return publicPost
}

async function updateLocalCommunityPost(
  id: string,
  body: CommunityUpdateRequest,
): Promise<CommunityPost> {
  const posts = loadLocalStoragePosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) {
    throw new CommunityApiError('해당 게시글을 찾을 수 없습니다.', 404, 'NOT_FOUND')
  }

  const existing = posts[index]
  const passwordMatches = (await hashPassword(body.password)) === existing.passwordHash
  if (!passwordMatches) {
    throw new CommunityApiError('비밀번호가 일치하지 않습니다.', 403, 'INVALID_PASSWORD')
  }

  const updatedPost: StoredCommunityPost = {
    ...existing,
    title: body.title.trim(),
    content: body.content.trim(),
    category: body.category ?? existing.category,
    festivalName: body.festivalName?.trim() || existing.festivalName,
    partyDate: body.partyDate || existing.partyDate,
    rating: body.rating ?? existing.rating,
    updatedAt: new Date().toISOString(),
  }

  posts[index] = updatedPost
  saveLocalStoragePosts(posts)
  const { passwordHash: _, ...publicPost } = updatedPost
  return publicPost
}

async function deleteLocalCommunityPost(id: string, body: CommunityDeleteRequest): Promise<void> {
  const posts = loadLocalStoragePosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) {
    throw new CommunityApiError('해당 게시글을 찾을 수 없습니다.', 404, 'NOT_FOUND')
  }

  const existing = posts[index]
  const passwordMatches = (await hashPassword(body.password)) === existing.passwordHash
  if (!passwordMatches) {
    throw new CommunityApiError('비밀번호가 일치하지 않습니다.', 403, 'INVALID_PASSWORD')
  }

  saveLocalStoragePosts(posts.filter((post) => post.id !== id))
}

export async function fetchCommunityPosts(endpoint: string): Promise<CommunityPost[]> {
  try {
    const result = await request<{ posts: CommunityPost[] }>(endpoint, {
      method: 'GET',
    })
    return result.posts
  } catch (error) {
    if (canUseLocalFallback(error)) {
      return loadLocalStoragePosts().map(({ passwordHash, ...post }) => post)
    }
    throw error
  }
}

export async function createCommunityPost(
  endpoint: string,
  body: CommunityCreateRequest,
): Promise<CommunityPost> {
  try {
    return request<CommunityPost>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (canUseLocalFallback(error)) {
      return createLocalCommunityPost(body)
    }
    throw error
  }
}

export async function updateCommunityPost(
  endpoint: string,
  id: string,
  body: CommunityUpdateRequest,
): Promise<CommunityPost> {
  try {
    return request<CommunityPost>(`${endpoint}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (canUseLocalFallback(error)) {
      return updateLocalCommunityPost(id, body)
    }
    throw error
  }
}

export async function deleteCommunityPost(
  endpoint: string,
  id: string,
  body: CommunityDeleteRequest,
): Promise<void> {
  try {
    await request<void>(`${endpoint}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (canUseLocalFallback(error)) {
      await deleteLocalCommunityPost(id, body)
      return
    }
    throw error
  }
}
