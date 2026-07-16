export type CommunityPostCategory = 'general' | 'party' | 'review'

export interface CommunityPost {
  id: string
  title: string
  content: string
  category: CommunityPostCategory
  festivalName?: string
  partyDate?: string
  rating?: number
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
  category?: CommunityPostCategory
  festivalName?: string
  partyDate?: string
  rating?: number
}

export interface CommunityUpdateRequest {
  title: string
  content: string
  password: string
  category?: CommunityPostCategory
  festivalName?: string
  partyDate?: string
  rating?: number
}

export interface CommunityDeleteRequest {
  password: string
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
}