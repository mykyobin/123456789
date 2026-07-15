export interface CommunityPost {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CommunityListResponse {
  posts: CommunityPost[]
}

export interface CommunityCreateRequest {
  title: string
  content: string
  password: string
}

export interface CommunityUpdateRequest {
  title: string
  content: string
  password: string
}

export interface CommunityDeleteRequest {
  password: string
}

export interface ApiErrorBody {
  error?: string
  code?: string
}
