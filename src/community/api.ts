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

export async function fetchCommunityPosts(endpoint: string): Promise<CommunityPost[]> {
  const result = await request<{ posts: CommunityPost[] }>(endpoint, {
    method: 'GET',
  })
  return result.posts
}

export async function createCommunityPost(
  endpoint: string,
  body: CommunityCreateRequest,
): Promise<CommunityPost> {
  return request<CommunityPost>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCommunityPost(
  endpoint: string,
  id: string,
  body: CommunityUpdateRequest,
): Promise<CommunityPost> {
  return request<CommunityPost>(`${endpoint}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteCommunityPost(
  endpoint: string,
  id: string,
  body: CommunityDeleteRequest,
): Promise<void> {
  await request<void>(`${endpoint}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}
