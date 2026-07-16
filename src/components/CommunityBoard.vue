<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import festivalJson from '../../netlify/functions/data/seoul-festivals.json'
import {
  createCommunityPost,
  createLocalCommunityPost,
  deleteCommunityPost,
  fetchCommunityPosts,
  loadLocalCommunityPosts,
  updateCommunityPost,
} from '../community/api'
import type { CommunityPost } from '../../shared/community-contract'

const endpoint = '/api/community'
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const posts = ref<CommunityPost[]>([])
const draftTitle = ref('')
const draftContent = ref('')
const draftPassword = ref('')
const draftCategory = ref<'general' | 'party' | 'review'>('general')
const draftFestivalName = ref('')
const draftPartyDate = ref('')
const draftRating = ref<number | null>(null)
const showDraftFestivalSuggestions = ref(false)
const editingPostId = ref<string | null>(null)
const editTitle = ref('')
const editContent = ref('')
const editPassword = ref('')
const editCategory = ref<'general' | 'party' | 'review'>('general')
const editFestivalName = ref('')
const editPartyDate = ref('')
const editRating = ref<number | null>(null)
const deletingPostId = ref<string | null>(null)
const deletePassword = ref('')
const showEditFestivalSuggestions = ref(false)

const festivalNames = (
  (festivalJson as { items: Array<{ title?: string }> }).items ?? []
)
  .map((item) => item.title ?? '')
  .filter((title) => title)

const draftFestivalSuggestions = computed(() => {
  if (
    draftCategory.value !== 'party' &&
    draftCategory.value !== 'review'
  ) {
    return []
  }

  const query = draftFestivalName.value.trim().toLowerCase()
  if (!query) return []

  return festivalNames
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 5)
})

const editFestivalSuggestions = computed(() => {
  if (editCategory.value !== 'party' && editCategory.value !== 'review') {
    return []
  }

  const query = editFestivalName.value.trim().toLowerCase()
  if (!query) return []

  return festivalNames
    .filter((title) => title.toLowerCase().includes(query))
    .slice(0, 5)
})

function selectDraftFestivalName(value: string): void {
  draftFestivalName.value = value
  showDraftFestivalSuggestions.value = false
}

function selectEditFestivalName(value: string): void {
  editFestivalName.value = value
  showEditFestivalSuggestions.value = false
}

const canCreate = computed(
  () => {
    const hasBaseFields =
      draftTitle.value.trim().length > 0 && draftContent.value.trim().length > 0 && draftPassword.value.trim().length > 0
    const requiresFestivalName =
      draftCategory.value === 'party' || draftCategory.value === 'review'
    const hasFestivalName = !requiresFestivalName || draftFestivalName.value.trim().length > 0
    const requiresRating = draftCategory.value === 'review'
    const hasRating = !requiresRating || (draftRating.value !== null && draftRating.value >= 1 && draftRating.value <= 5)
    return hasBaseFields && hasFestivalName && hasRating
  },
)

const canSaveEdit = computed(
  () => {
    if (editingPostId.value === null) return false
    const baseFields = editTitle.value.trim().length > 0 && editContent.value.trim().length > 0 && editPassword.value.trim().length > 0
    const requiresFestivalName = editCategory.value === 'party' || editCategory.value === 'review'
    const hasFestivalName = !requiresFestivalName || editFestivalName.value.trim().length > 0
    const requiresRating = editCategory.value === 'review'
    const hasRating = !requiresRating || (editRating.value !== null && editRating.value >= 1 && editRating.value <= 5)
    return baseFields && hasFestivalName && hasRating
  },
)

function resetForm(): void {
  draftTitle.value = ''
  draftContent.value = ''
  draftPassword.value = ''
  draftCategory.value = 'general'
  draftFestivalName.value = ''
  draftPartyDate.value = ''
  draftRating.value = null
  showDraftFestivalSuggestions.value = false
  showEditFestivalSuggestions.value = false
}

function openEdit(post: CommunityPost): void {
  editingPostId.value = post.id
  editTitle.value = post.title
  editContent.value = post.content
  editPassword.value = ''
  editCategory.value = post.category ?? 'general'
  editFestivalName.value = post.festivalName ?? ''
  editPartyDate.value = post.partyDate ?? ''
  editRating.value = post.rating ?? null
  errorMessage.value = ''
  successMessage.value = ''
}

function closeEdit(): void {
  editingPostId.value = null
  editTitle.value = ''
  editContent.value = ''
  editPassword.value = ''
  editCategory.value = 'general'
  editFestivalName.value = ''
  editPartyDate.value = ''
  editRating.value = null
}

function openDelete(post: CommunityPost): void {
  deletingPostId.value = post.id
  deletePassword.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

function closeDelete(): void {
  deletingPostId.value = null
  deletePassword.value = ''
}

function delayHideDraftFestivalSuggestions(): void {
  setTimeout(() => {
    showDraftFestivalSuggestions.value = false
  }, 150)
}

function delayHideEditFestivalSuggestions(): void {
  setTimeout(() => {
    showEditFestivalSuggestions.value = false
  }, 150)
}

async function loadPosts(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    posts.value = await fetchCommunityPosts(endpoint)
  } catch (error) {
    posts.value = loadLocalCommunityPosts()
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '커뮤니티 게시판을 불러오는 중 오류가 발생했습니다.'
  } finally {
    isLoading.value = false
  }
}

async function submitPost(): Promise<void> {
  if (!canCreate.value) return
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const newPost = await createCommunityPost(endpoint, {
      title: draftTitle.value.trim(),
      content: draftContent.value.trim(),
      password: draftPassword.value,
      category: draftCategory.value,
      festivalName: draftFestivalName.value.trim() || undefined,
      partyDate: draftPartyDate.value || undefined,
      rating: draftRating.value ?? undefined,
    })
    posts.value = [newPost, ...posts.value]
    resetForm()
    successMessage.value = '게시글이 등록되었습니다.'
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = '게시글 등록 중 오류가 발생했습니다.'
    }

    try {
      const newPost = await createLocalCommunityPost({
        title: draftTitle.value.trim(),
        content: draftContent.value.trim(),
        password: draftPassword.value,
        category: draftCategory.value,
        festivalName: draftFestivalName.value.trim() || undefined,
        partyDate: draftPartyDate.value || undefined,
        rating: draftRating.value ?? undefined,
      })
      posts.value = [newPost, ...posts.value]
      resetForm()
      successMessage.value = '서버 연결 없이 로컬에 게시글이 저장되었습니다.'
      errorMessage.value = ''
    } catch (fallbackError) {
      errorMessage.value =
        fallbackError instanceof Error
          ? fallbackError.message
          : '게시글 등록 중 오류가 발생했습니다.'
    }
  } finally {
    isLoading.value = false
  }
}

async function saveEdit(): Promise<void> {
  if (!canSaveEdit.value || editingPostId.value === null) return
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const updatedPost = await updateCommunityPost(endpoint, editingPostId.value, {
      title: editTitle.value.trim(),
      content: editContent.value.trim(),
      password: editPassword.value,
      category: editCategory.value,
      festivalName: editFestivalName.value.trim() || undefined,
      partyDate: editPartyDate.value || undefined,
      rating: editRating.value ?? undefined,
    })

    posts.value = posts.value.map((post) =>
      post.id === updatedPost.id ? updatedPost : post,
    )
    successMessage.value = '게시글이 수정되었습니다.'
    closeEdit()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '게시글 수정 중 오류가 발생했습니다.'
  } finally {
    isLoading.value = false
  }
}

async function confirmDelete(): Promise<void> {
  if (!deletingPostId.value) return
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await deleteCommunityPost(endpoint, deletingPostId.value, {
      password: deletePassword.value,
    })
    posts.value = posts.value.filter((post) => post.id !== deletingPostId.value)
    successMessage.value = '게시글이 삭제되었습니다.'
    closeDelete()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '게시글 삭제 중 오류가 발생했습니다.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadPosts()
})
</script>

<template>
  <section id="community" class="content-section community-section">
    <div class="section-header">
      <div>
        <span class="section-kicker">커뮤니티</span>
        <h2>익명 게시판</h2>
        <p>서울 지역 이야기를 나누고, 수정/삭제는 작성 시 설정한 비밀번호로 확인합니다.</p>
      </div>
    </div>

    <div class="community-grid">
      <article class="community-form card-panel">
        <h3>글쓰기</h3>
        <label>
          제목
          <input v-model="draftTitle" type="text" placeholder="게시글 제목을 입력하세요" />
        </label>
        <label>
          카테고리
          <select v-model="draftCategory">
            <option value="general">일반</option>
            <option value="party">파티 모집</option>
            <option value="review">축제 리뷰</option>
          </select>
        </label>
        <label v-if="draftCategory === 'party' || draftCategory === 'review'" class="autocomplete-field">
          축제 이름
          <input
            v-model="draftFestivalName"
            @focus="showDraftFestivalSuggestions = true"
            @input="showDraftFestivalSuggestions = true"
            @blur="delayHideDraftFestivalSuggestions"
            type="search"
            placeholder="축제 이름을 입력하세요"
            autocomplete="off"
          />
          <ul
            v-if="showDraftFestivalSuggestions"
            v-show="showDraftFestivalSuggestions"
            class="suggestion-list"
          >
            <li v-if="draftFestivalName && draftFestivalSuggestions.length === 0" class="no-results">
              일치하는 축제가 없습니다.
            </li>
            <li
              v-for="suggestion in draftFestivalSuggestions"
              :key="suggestion"
              @mousedown.prevent="selectDraftFestivalName(suggestion)"
            >
              {{ suggestion }}
            </li>
          </ul>
        </label>
        <label v-if="draftCategory === 'party'">
          동행 날짜
          <input v-model="draftPartyDate" type="date" />
        </label>
        <label v-if="draftCategory === 'review'">
          평점
          <input v-model.number="draftRating" type="number" min="1" max="5" placeholder="1~5" />
        </label>
        <label>
          내용
          <textarea v-model="draftContent" rows="5" placeholder="내용을 입력하세요"></textarea>
        </label>
        <label>
          비밀번호
          <input v-model="draftPassword" type="password" placeholder="수정/삭제용 비밀번호" />
        </label>
        <div class="form-actions">
          <button @click="submitPost" :disabled="!canCreate || isLoading">
            등록하기
          </button>
          <button type="button" class="secondary" @click="resetForm" :disabled="isLoading">
            초기화
          </button>
        </div>
        <p class="hint">게시글 등록 후, 같은 비밀번호로 수정 또는 삭제할 수 있습니다.</p>
      </article>

      <section class="community-list card-panel">
        <div class="community-list-header">
          <h3>최근 글</h3>
          <span v-if="isLoading">로딩 중...</span>
          <span v-else>{{ posts.length }}개</span>
        </div>

        <p class="alert error" v-if="errorMessage">{{ errorMessage }}</p>
        <p class="alert success" v-if="successMessage">{{ successMessage }}</p>

        <template v-if="posts.length > 0">
          <article v-for="post in posts" :key="post.id" class="community-post">
            <div class="post-meta">
              <strong>{{ post.title }}</strong>
              <time :datetime="post.createdAt">{{ new Date(post.createdAt).toLocaleString('ko-KR') }}</time>
            </div>
            <p class="post-content">{{ post.content }}</p>
            <div class="post-actions">
              <button @click="openEdit(post)">수정</button>
              <button class="secondary" @click="openDelete(post)">삭제</button>
            </div>

            <div class="post-meta-extra">
              <span v-if="post.category !== 'general'" class="post-category">
                [{{ post.category === 'party' ? '파티 모집' : '리뷰' }}]
              </span>
              <span v-if="post.festivalName">축제: {{ post.festivalName }}</span>
              <span v-if="post.partyDate">동행 날짜: {{ post.partyDate }}</span>
              <span v-if="post.rating">평점: {{ post.rating }}/5</span>
            </div>

            <div v-if="editingPostId === post.id" class="edit-panel">
              <label>
                제목
                <input v-model="editTitle" type="text" />
              </label>
              <label>
                카테고리
                <select v-model="editCategory">
                  <option value="general">일반</option>
                  <option value="party">파티 모집</option>
                  <option value="review">축제 리뷰</option>
                </select>
              </label>
              <label v-if="editCategory === 'party' || editCategory === 'review'" class="autocomplete-field">
                축제 이름
                <input
                  v-model="editFestivalName"
                  @focus="showEditFestivalSuggestions = true"
                  @input="showEditFestivalSuggestions = true"
                  @blur="delayHideEditFestivalSuggestions"
                  type="search"
                />
                <ul
                  v-if="showEditFestivalSuggestions"
                  v-show="showEditFestivalSuggestions"
                  class="suggestion-list"
                >
                  <li v-if="editFestivalName && editFestivalSuggestions.length === 0" class="no-results">
                    일치하는 축제가 없습니다.
                  </li>
                  <li
                    v-for="suggestion in editFestivalSuggestions"
                    :key="suggestion"
                    @mousedown.prevent="selectEditFestivalName(suggestion)"
                  >
                    {{ suggestion }}
                  </li>
                </ul>
              </label>
              <label v-if="editCategory === 'party'">
                동행 날짜
                <input v-model="editPartyDate" type="date" />
              </label>
              <label v-if="editCategory === 'review'">
                평점
                <input v-model.number="editRating" type="number" min="1" max="5" />
              </label>
              <label>
                내용
                <textarea v-model="editContent" rows="4"></textarea>
              </label>
              <label>
                비밀번호
                <input v-model="editPassword" type="password" />
              </label>
              <div class="form-actions">
                <button @click="saveEdit" :disabled="!canSaveEdit || isLoading">저장</button>
                <button type="button" class="secondary" @click="closeEdit" :disabled="isLoading">취소</button>
              </div>
            </div>

            <div v-if="deletingPostId === post.id" class="delete-panel">
              <label>
                비밀번호
                <input v-model="deletePassword" type="password" />
              </label>
              <div class="form-actions">
                <button @click="confirmDelete" :disabled="!deletePassword || isLoading">삭제</button>
                <button type="button" class="secondary" @click="closeDelete" :disabled="isLoading">취소</button>
              </div>
            </div>
          </article>
        </template>

        <p v-else class="empty-state">아직 등록된 게시글이 없습니다. 첫 글을 남겨보세요!</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.community-section {
  width: min(1120px, calc(100% - 40px));
  margin: 20px auto 0;
  padding: 56px 0 90px;
}

.community-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 24px;
}

.card-panel {
  padding: 24px;
  border: 1px solid #e7ebf2;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 36px rgba(31, 51, 91, 0.06);
}

.community-form h3,
.community-list-header h3 {
  margin: 0 0 18px;
  font-size: 20px;
}

.community-form label,
.edit-panel label,
.delete-panel label {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  font-size: 14px;
  color: #3a4a63;
}

.community-form input,
.community-form textarea,
.community-form select,
.edit-panel input,
.edit-panel textarea,
.edit-panel select,
.delete-panel input {
  width: 100%;
  min-height: 44px;
  padding: 12px 14px;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #f9fbff;
  font-size: 14px;
  color: #172033;
}

.autocomplete-field {
  position: relative;
}

.autocomplete-field input {
  width: 100%;
  min-height: 44px;
  padding: 12px 14px;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #ffffff;
  color: #172033;
  font-size: 14px;
}

.autocomplete-field input:focus {
  outline: none;
  border-color: #3165ff;
  box-shadow: 0 0 0 4px rgba(49, 101, 255, 0.12);
}

.autocomplete-field input::placeholder {
  color: #9b9ebf;
}

.suggestion-list {
  position: absolute;
  left: 0;
  right: 0;
  margin: 6px 0 0;
  padding: 8px 0;
  border: 1px solid #d8dee8;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 14px 32px rgba(31, 51, 91, 0.08);
  list-style: none;
  max-height: 220px;
  overflow-y: auto;
  z-index: 10;
}

.suggestion-list li {
  padding: 10px 14px;
  cursor: pointer;
  color: #172033;
  font-size: 14px;
}

.suggestion-list li.no-results {
  cursor: default;
  color: #7c879a;
}

.suggestion-list li:hover {
  background: #f0f4ff;
}

.community-form textarea,
.edit-panel textarea {
  min-height: 120px;
  resize: vertical;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

button {
  border: none;
  border-radius: 14px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
  background: #3165ff;
  transition: transform 0.18s ease, background 0.18s ease;
}

button.secondary {
  background: #e7ebf2;
  color: #2f3d55;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:not(:disabled):hover {
  transform: translateY(-1px);
}

.community-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.alert {
  margin: 0 0 18px;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 14px;
}

.alert.error {
  background: #ffe9ea;
  color: #9b2330;
}

.alert.success {
  background: #eaf7ec;
  color: #1d6f31;
}

.community-post {
  padding: 18px;
  margin-bottom: 18px;
  border: 1px solid #edf1f7;
  border-radius: 20px;
  background: #fcfdff;
}

.post-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.post-meta strong {
  font-size: 16px;
}

.post-content {
  margin: 0 0 18px;
  color: #4a5568;
  line-height: 1.8;
  white-space: pre-wrap;
}

.post-actions {
  display: flex;
  gap: 12px;
}

.edit-panel,
.delete-panel {
  margin-top: 18px;
  padding: 18px;
  border-top: 1px solid #e7ebf2;
}

.hint,
.empty-state {
  margin: 18px 0 0;
  color: #5b6a82;
  font-size: 13px;
}

@media (max-width: 900px) {
  .community-grid {
    grid-template-columns: 1fr;
  }
}
</style>
