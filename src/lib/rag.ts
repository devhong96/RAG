import { checkCitations, type CitationCheck } from "./citations.js"
import { condenseQuestion, ConversationStore, trimHistory, type ConversationStorePort } from "./conversation.js"
import { searchDocuments, type SearchResult } from "./documents.js"
import { chatComplete, type ChatMessage } from "./llm.js"

/** RAG 파이프라인: 검색 → 컨텍스트 조립 → 생성. (강의 23~24) */
export const RAG_COLLECTION = "rag-docs"

export interface AnswerResult {
  answer: string
  sources: SearchResult[]
  /**
   * 답변의 인용 표기 검사 결과. (패턴 11)
   * 답을 막지는 않고 신호만 준다 - 판단은 호출부가 한다.
   */
  citations: CitationCheck
}

export async function answerQuestion(question: string, nResults = 3): Promise<AnswerResult> {
  const sources = await searchDocuments(RAG_COLLECTION, question, nResults)
  const context = buildContext(sources)
  const answer = await chatComplete(buildMessages(question, context))
  return { answer, sources, citations: checkCitations(answer, sources.length) }
}

export interface RagDependencies {
  search(question: string, nResults: number): Promise<SearchResult[]>
  generate(messages: ChatMessage[]): Promise<string>
}

export interface ReliableAnswer extends AnswerResult {
  attempts: number
}

/**
 * 의존성 주입 + 자체점검(패턴 19, 31) 예제.
 * 생성 뒤 인용을 코드로 검사하고 실패하면 피드백을 붙여 딱 한 번 다시 생성한다.
 * 무한 자기수정 루프를 막기 위해 기본 시도 횟수는 2회로 제한한다.
 */
export async function answerQuestionReliably(
  question: string,
  nResults = 3,
  dependencies: RagDependencies = {
    search: (query, count) => searchDocuments(RAG_COLLECTION, query, count),
    generate: (messages) => chatComplete(messages),
  },
  maxAttempts = 2,
): Promise<ReliableAnswer> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts는 1 이상의 정수여야 합니다")
  }

  const sources = await dependencies.search(question, nResults)
  const baseMessages = buildMessages(question, buildContext(sources))
  let answer = ""
  let citations = checkCitations(answer, sources.length)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const messages = attempt === 1
      ? baseMessages
      : [
          ...baseMessages,
          { role: "assistant", content: answer } as const,
          {
            role: "user",
            content: "자체점검에서 인용 누락 또는 존재하지 않는 자료 번호가 발견됐습니다. 내용은 새로 만들지 말고 올바른 [자료 n] 인용을 붙여 답변 전체를 다시 작성하세요.",
          } as const,
        ]
    answer = await dependencies.generate(messages)
    citations = checkCitations(answer, sources.length)
    // 검색 결과가 없으면 인용할 자료 번호 자체가 없다. 이 경우에는 "답할 수 없음" 응답을
    // 인용 누락으로 오판해 같은 생성을 반복하지 않는다.
    if (sources.length === 0 || (!citations.missing && citations.invalid.length === 0)) {
      return { answer, sources, citations, attempts: attempt }
    }
  }

  return { answer, sources, citations, attempts: maxAttempts }
}

/** 검색 결과를 LLM 이 읽기 좋은 형태로 바꾼다. 출처와 관련도를 함께 넘긴다. */
function buildContext(sources: SearchResult[]): string {
  return sources
    .map((s, i) => {
      const source = s.metadata?.source ?? "unknown"
      const relevance = (1 - s.distance).toFixed(2)
      return `[자료 ${i + 1} - 출처: ${source}, 관련도: ${relevance}]\n${s.document}`
    })
    .join("\n\n")
}

/**
 * 프롬프트 설계의 세 가지 축 (강의 24)
 *   1. 역할을 부여한다
 *   2. 근거 규칙을 준다 — 자료 밖의 내용을 지어내지 못하게
 *   3. 형식 규칙을 준다 — 길이와 언어
 */
function buildMessages(
  question: string,
  context: string,
  history: readonly ChatMessage[] = [],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `당신은 주어진 자료를 바탕으로 사용자 질문에 답하는 한국어 도우미입니다.
다음 규칙을 반드시 지켜 주세요.

1. 자료에 답이 있으면 반드시 그 내용으로 답하세요. 자료를 다시 읽고 확인한 뒤 답하세요.
2. 숫자, 단위, 고유명사는 자료에 적힌 그대로 인용하세요.
3. 자료 어디에도 근거가 없을 때만 "제공된 자료로는 답할 수 없습니다"라고 답하세요.
   자료에 답이 있는데 이렇게 답하면 안 됩니다.
4. 모든 단어를 한국어로 쓰세요. 영어 단어를 섞지 마세요.
5. 두세 문장 안에 핵심만 정리하고, 자료에 없는 정보는 덧붙이지 마세요.
6. 문장 끝마다 근거로 삼은 자료 번호를 [자료 1] 처럼 표기하세요.
   여러 자료를 함께 썼다면 [자료 1, 2] 로 적습니다.
   이 표기는 코드가 검사하므로, 실제로 받은 자료 번호만 쓰세요.`,
    },
    // 이전 대화를 system 다음, 이번 질문 앞에 그대로 끼워 넣는다.
    // 대화 기록은 "맥락"이고 자료는 "근거"라서 역할이 다르므로 섞지 않고 따로 둔다.
    ...history,
    {
      role: "user",
      content: `다음 자료를 참고해서 질문에 답해 주세요.\n\n[자료]\n${context}\n\n[질문]\n${question}`,
    },
  ]
}

/** 세션별 대화 기록. 서버와 CLI 데모가 함께 쓴다. */
export const conversations = new ConversationStore()

export interface ConversationalAnswer extends AnswerResult {
  /** 실제로 검색에 사용한 질의. 원문과 다르면 압축이 일어난 것이다. */
  searchQuery: string
}

/**
 * 대화 맥락을 유지하는 RAG. (책 8장 대응)
 *
 * 흐름: 질문 압축 -> 검색 -> 컨텍스트 조립 -> (대화 기록 포함) 생성 -> 기록 저장
 *
 * `answerQuestion` 과 나누어 둔 이유는, 단발 질의에는 압축 단계의 LLM 호출이 순수한 낭비이기
 * 때문이다. 대화형이 필요할 때만 그 비용을 내도록 진입점을 따로 뒀다.
 */
export async function answerInConversation(
  sessionId: string,
  question: string,
  nResults = 3,
  store: ConversationStorePort = conversations,
): Promise<ConversationalAnswer> {
  const history = trimHistory(store.get(sessionId))
  const searchQuery = await condenseQuestion(history, question)

  const sources = await searchDocuments(RAG_COLLECTION, searchQuery, nResults)
  const context = buildContext(sources)
  const answer = await chatComplete(buildMessages(question, context, history))

  // 답변 생성이 성공한 뒤에 기록한다. 실패한 턴을 기록에 남기면
  // 다음 질문의 압축이 없는 답변을 참고하게 되어 맥락이 오염된다.
  store.append(sessionId, question, answer)

  return { answer, sources, searchQuery, citations: checkCitations(answer, sources.length) }
}
