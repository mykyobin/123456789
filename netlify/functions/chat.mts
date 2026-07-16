import type { Config } from '@netlify/functions'
import OpenAI from 'openai'
import type {
  ChatHistoryMessage,
  ChatIntent,
  FestivalChatRequest,
  FestivalChatResponse,
  FestivalSource,
} from '../../shared/chat-contract'
import {
  detectChatIntent,
  isFestivalFollowUp,
  isSimpleConversation,
  lastUserMessage,
} from './_shared/chat-intent'
import { createConversationFallback } from './_shared/conversation-answer'
import { createFallbackAnswer } from './_shared/festival-answer'
import { searchFestivals } from './_shared/festival-search'
import { createSuggestedQuestions } from './_shared/suggested-questions'

const DEFAULT_MODEL = 'gpt-5-mini'
const MAX_QUESTION_LENGTH = 300
const MAX_HISTORY_MESSAGES = 8
const MAX_HISTORY_MESSAGE_LENGTH = 600

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

function isRequestBody(value: unknown): value is FestivalChatRequest {
  if (typeof value !== 'object' || value === null) return false
  return 'question' in value && typeof value.question === 'string'
}

function sanitizeHistory(value: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (entry): entry is ChatHistoryMessage =>
        typeof entry === 'object' &&
        entry !== null &&
        'role' in entry &&
        (entry.role === 'user' || entry.role === 'assistant') &&
        'content' in entry &&
        typeof entry.content === 'string',
    )
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim().slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
}

function dataContext(sources: FestivalSource[]): string {
  return JSON.stringify(
    sources.map((source) => ({
      contentId: source.contentId,
      title: source.title,
      address: source.address,
      eventPlace: source.eventPlace,
      startDate: source.startDate,
      endDate: source.endDate,
      playTime: source.playTime,
      fee: source.fee,
      ageLimit: source.ageLimit,
      phone: source.phone,
      imageUrl: source.imageUrl,
      longitude: source.longitude,
      latitude: source.latitude,
      status: source.status,
      programExcerpt: source.programExcerpt,
    })),
    null,
    2,
  )
}

function instructionsFor(intent: ChatIntent, hasSources: boolean): string {
  const common = [
    '한국어로 친절하고 자연스럽게 답하세요.',
    '사용자의 질문에 먼저 직접 답하고, 불필요하게 길게 설명하지 마세요.',
    '이전 대화가 제공되면 대명사와 후속 질문의 맥락을 이어서 답하세요.',
  ]

  if (intent === 'conversation') {
    return [
      ...common,
      '당신은 서울 문화행사 서비스의 AI 챗봇이지만 간단한 인사, 자기소개, 감사, 사용법, 일상적인 대화에도 자연스럽게 답할 수 있습니다.',
      '모든 질문을 축제나 공공데이터로 억지로 연결하지 마세요.',
      '이번 요청에는 축제 검색 결과가 제공되지 않았으므로, 공공데이터에서 찾지 못했다는 문구를 사용하지 마세요.',
      '실시간 정보나 확인하지 못한 사실은 아는 척하지 말고 한계를 짧게 밝히세요.',
    ].join('\n')
  }

  return [
    ...common,
    '당신은 서울 축제·공연·행사 상담 챗봇입니다.',
    '행사의 날짜, 주소, 장소, 전화번호, 요금, 좌표 등 구체적인 사실은 제공된 공공데이터만 근거로 답하세요.',
    '날짜, 주소, 전화번호, 요금, 좌표 숫자는 임의로 바꾸거나 반올림하지 마세요.',
    hasSources
      ? '검색 결과 중 질문과 관련된 항목을 골라 답하고, 후보가 여러 개면 번호 목록으로 구분하세요.'
      : '검색 결과가 없으므로 행사를 지어내지 말고, 필요한 축제명·지역·날짜를 한 가지 질문으로 되물어보세요.',
    '제공되지 않은 정보는 정보가 없다고 솔직하게 밝히세요.',
  ].join('\n')
}

function createModelInput(options: {
  question: string
  history: ChatHistoryMessage[]
  intent: ChatIntent
  sources: FestivalSource[]
}): Array<{ role: 'user' | 'assistant'; content: string }> {
  const { question, history, intent, sources } = options
  const currentContent =
    intent === 'festival'
      ? [
          `사용자 질문:\n${question}`,
          `검색된 서울 축제·공연·행사 공공데이터 (${sources.length}건):\n${dataContext(sources)}`,
        ].join('\n\n')
      : question

  return [...history, { role: 'user', content: currentContent }]
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'POST 요청만 허용됩니다.', code: 'METHOD_NOT_ALLOWED' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          Allow: 'POST',
        },
      },
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return json(
      { error: '올바른 JSON 요청이 아닙니다.', code: 'INVALID_JSON' },
      400,
    )
  }

  if (!isRequestBody(body)) {
    return json(
      { error: 'question 문자열이 필요합니다.', code: 'INVALID_REQUEST' },
      400,
    )
  }

  const question = body.question.trim()
  if (!question) {
    return json(
      { error: '질문을 입력해 주세요.', code: 'EMPTY_QUESTION' },
      400,
    )
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return json(
      {
        error: `질문은 ${MAX_QUESTION_LENGTH}자 이하로 입력해 주세요.`,
        code: 'QUESTION_TOO_LONG',
      },
      400,
    )
  }

  const history = sanitizeHistory(body.history)
  const previousQuestion = lastUserMessage(history)
  const directSources = isSimpleConversation(question)
    ? []
    : searchFestivals(question, { limit: 5 })
  const previousResultCount = previousQuestion
    ? searchFestivals(previousQuestion, { limit: 1 }).length
    : 0
  const intent = detectChatIntent({
    question,
    history,
    directResultCount: directSources.length,
    previousResultCount,
  })

  let sources = intent === 'festival' ? directSources : []

  // "그 축제 요금은?" 같은 후속 질문은 직전 사용자 질문과 합쳐 다시 검색한다.
  // 현재 문장만 검색했을 때 생기는 우연한 문자열 일치보다 대화 맥락을 우선한다.
  if (intent === 'festival' && isFestivalFollowUp(question)) {
    if (previousQuestion) {
      const contextualSources = searchFestivals(`${previousQuestion} ${question}`, {
        limit: 5,
      })
      if (contextualSources.length > 0) sources = contextualSources
    }
  }

  const generatedAt = new Date().toISOString()
  const suggestedQuestions = createSuggestedQuestions(intent, sources)
  const recoveryRequired = intent === 'festival' && sources.length === 0
  const forceFallback = process.env.CHATBOT_FORCE_FALLBACK === 'true'
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL

  if (!apiKey || forceFallback) {
    const reply =
      intent === 'conversation'
        ? createConversationFallback(question)
        : createFallbackAnswer(sources)

    const response: FestivalChatResponse = {
      reply,
      sources,
      suggestedQuestions,
      recoveryRequired,
      meta: {
        mode: 'fallback',
        intent,
        resultCount: sources.length,
        generatedAt,
      },
      warning: !apiKey
        ? 'OPENAI_API_KEY가 없어 로컬 폴백 답변으로 동작했습니다.'
        : undefined,
    }
    return json(response)
  }

  try {
    const openai = new OpenAI({ apiKey })
    const modelResponse = await openai.responses.create({
      model,
      store: false,
      reasoning: {
        effort: 'low',
      },
      max_output_tokens: 1200,
      instructions: instructionsFor(intent, sources.length > 0),
      input: createModelInput({ question, history, intent, sources }),
    })

    const reply = modelResponse.output_text.trim()
    if (!reply) throw new Error('OpenAI response was empty')

    const response: FestivalChatResponse = {
      reply,
      sources,
      suggestedQuestions,
      recoveryRequired,
      meta: {
        mode: 'llm',
        intent,
        model,
        requestId: modelResponse._request_id ?? undefined,
        resultCount: sources.length,
        generatedAt,
      },
    }

    return json(response)
  } catch (error) {
    console.error(
      'OpenAI request failed:',
      error instanceof Error ? error.message : 'unknown error',
    )

    const response: FestivalChatResponse = {
      reply:
        intent === 'conversation'
          ? createConversationFallback(question)
          : createFallbackAnswer(sources),
      sources,
      suggestedQuestions,
      recoveryRequired,
      meta: {
        mode: 'fallback',
        intent,
        model,
        resultCount: sources.length,
        generatedAt,
      },
      warning: 'LLM 호출에 실패하여 로컬 폴백 답변으로 응답했습니다.',
    }

    return json(response)
  }
}

export const config: Config = {
  path: '/api/chat',
  method: 'POST',
  rateLimit: {
    action: 'rate_limit',
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
}
