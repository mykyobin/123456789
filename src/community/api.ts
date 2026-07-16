import type {
  CommunityCreateRequest,
  CommunityDeleteRequest,
  CommunityPost,
  CommunityPostCategory,
  CommunityUpdateRequest,
} from '../../shared/community-contract'

export const COMMUNITY_STORAGE_KEY = 'community-posts'
const CORRUPTED_STORAGE_BACKUP_KEY = 'community-posts-corrupted-backup'

interface StoredCommunityPost extends CommunityPost {
  passwordHash: string
}

interface NormalizedPostInput {
  title: string
  content: string
  password: string
  category: CommunityPostCategory
  festivalName?: string
  partyDate?: string
  rating?: number
}

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

function getStorage(): Storage {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is unavailable')
    }
    return localStorage
  } catch {
    throw new CommunityApiError(
      '브라우저 저장소를 사용할 수 없습니다. 시크릿 모드나 저장소 차단 설정을 확인해 주세요.',
      500,
      'STORAGE_UNAVAILABLE',
    )
  }
}

function isValidCategory(value: unknown): value is CommunityPostCategory {
  return value === 'general' || value === 'party' || value === 'review'
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

function isStoredCommunityPost(value: unknown): value is StoredCommunityPost {
  if (typeof value !== 'object' || value === null) return false

  const post = value as Record<string, unknown>
  return (
    typeof post.id === 'string' &&
    typeof post.title === 'string' &&
    typeof post.content === 'string' &&
    isValidCategory(post.category) &&
    isOptionalString(post.festivalName) &&
    isOptionalString(post.partyDate) &&
    isOptionalNumber(post.rating) &&
    typeof post.createdAt === 'string' &&
    typeof post.updatedAt === 'string' &&
    typeof post.passwordHash === 'string'
  )
}

function backupAndResetCorruptedStorage(storage: Storage, raw: string): void {
  try {
    storage.setItem(CORRUPTED_STORAGE_BACKUP_KEY, raw)
  } catch {
    // 백업 실패 시에도 손상된 원본 때문에 게시판 전체가 멈추지 않도록 복구를 계속합니다.
  }

  try {
    storage.removeItem(COMMUNITY_STORAGE_KEY)
  } catch {
    // 읽기 전용 저장소에서는 다음 저장 시점에 사용자에게 명확한 오류를 보여줍니다.
  }
}

function readStoredPosts(): StoredCommunityPost[] {
  const storage = getStorage()
  let raw: string | null

  try {
    raw = storage.getItem(COMMUNITY_STORAGE_KEY)
  } catch {
    throw new CommunityApiError(
      '저장된 커뮤니티 글을 읽지 못했습니다.',
      500,
      'STORAGE_READ_FAILED',
    )
  }

  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every(isStoredCommunityPost)) {
      backupAndResetCorruptedStorage(storage, raw)
      return []
    }
    return parsed
  } catch {
    backupAndResetCorruptedStorage(storage, raw)
    return []
  }
}

function writeStoredPosts(posts: StoredCommunityPost[]): void {
  try {
    getStorage().setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(posts))
  } catch {
    throw new CommunityApiError(
      '게시글을 브라우저에 저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인해 주세요.',
      500,
      'STORAGE_WRITE_FAILED',
    )
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new CommunityApiError(
      '현재 브라우저에서는 비밀번호 보호 기능을 사용할 수 없습니다.',
      500,
      'CRYPTO_UNAVAILABLE',
    )
  }

  const encoded = new TextEncoder().encode(password)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return toHex(digest)
}

function createLocalId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizePostInput(
  body: CommunityCreateRequest | CommunityUpdateRequest,
  fallbackCategory: CommunityPostCategory = 'general',
): NormalizedPostInput {
  const title = body.title.trim()
  const content = body.content.trim()
  const password = body.password
  const category = body.category ?? fallbackCategory

  if (!title) {
    throw new CommunityApiError('제목을 입력해 주세요.', 400, 'EMPTY_TITLE')
  }
  if (!content) {
    throw new CommunityApiError('내용을 입력해 주세요.', 400, 'EMPTY_CONTENT')
  }
  if (!password.trim()) {
    throw new CommunityApiError('비밀번호를 입력해 주세요.', 400, 'EMPTY_PASSWORD')
  }
  if (!isValidCategory(category)) {
    throw new CommunityApiError('올바른 카테고리를 선택해 주세요.', 400, 'INVALID_CATEGORY')
  }

  const festivalName = body.festivalName?.trim()
  if (category !== 'general' && !festivalName) {
    throw new CommunityApiError('축제 이름을 입력해 주세요.', 400, 'EMPTY_FESTIVAL_NAME')
  }

  const rating = body.rating
  if (
    category === 'review' &&
    (rating === undefined || !Number.isFinite(rating) || rating < 1 || rating > 5)
  ) {
    throw new CommunityApiError('1에서 5 사이의 평점을 입력해 주세요.', 400, 'INVALID_RATING')
  }

  return {
    title,
    content,
    password,
    category,
    festivalName: category === 'general' ? undefined : festivalName,
    partyDate: category === 'party' ? body.partyDate?.trim() || undefined : undefined,
    rating: category === 'review' ? rating : undefined,
  }
}

function toPublicPost(post: StoredCommunityPost): CommunityPost {
  const { passwordHash: _, ...publicPost } = post
  return publicPost
}

export function loadLocalCommunityPosts(): CommunityPost[] {
  return readStoredPosts()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicPost)
}

export async function createCommunityPost(
  body: CommunityCreateRequest,
): Promise<CommunityPost> {
  const input = normalizePostInput(body)
  const now = new Date().toISOString()
  const newPost: StoredCommunityPost = {
    id: createLocalId(),
    title: input.title,
    content: input.content,
    category: input.category,
    festivalName: input.festivalName,
    partyDate: input.partyDate,
    rating: input.rating,
    createdAt: now,
    updatedAt: now,
    passwordHash: await hashPassword(input.password),
  }

  const posts = readStoredPosts()
  writeStoredPosts([newPost, ...posts])
  return toPublicPost(newPost)
}

export async function updateCommunityPost(
  id: string,
  body: CommunityUpdateRequest,
): Promise<CommunityPost> {
  const posts = readStoredPosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) {
    throw new CommunityApiError('해당 게시글을 찾을 수 없습니다.', 404, 'NOT_FOUND')
  }

  const existing = posts[index]
  if ((await hashPassword(body.password)) !== existing.passwordHash) {
    throw new CommunityApiError('비밀번호가 일치하지 않습니다.', 403, 'INVALID_PASSWORD')
  }

  const input = normalizePostInput(body, existing.category)
  const updatedPost: StoredCommunityPost = {
    ...existing,
    title: input.title,
    content: input.content,
    category: input.category,
    festivalName: input.festivalName,
    partyDate: input.partyDate,
    rating: input.rating,
    updatedAt: new Date().toISOString(),
  }

  posts[index] = updatedPost
  writeStoredPosts(posts)
  return toPublicPost(updatedPost)
}

export async function deleteCommunityPost(
  id: string,
  body: CommunityDeleteRequest,
): Promise<void> {
  const posts = readStoredPosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) {
    throw new CommunityApiError('해당 게시글을 찾을 수 없습니다.', 404, 'NOT_FOUND')
  }

  if (!body.password.trim()) {
    throw new CommunityApiError('비밀번호를 입력해 주세요.', 400, 'EMPTY_PASSWORD')
  }

  if ((await hashPassword(body.password)) !== posts[index].passwordHash) {
    throw new CommunityApiError('비밀번호가 일치하지 않습니다.', 403, 'INVALID_PASSWORD')
  }

  writeStoredPosts(posts.filter((post) => post.id !== id))
}
