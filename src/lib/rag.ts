import { searchDocuments, type SearchResult } from "./documents.js"
import { chatComplete, type ChatMessage } from "./llm.js"

/** RAG 파이프라인: 검색 → 컨텍스트 조립 → 생성. (강의 23~24) */
export const RAG_COLLECTION = "rag-docs"

export interface AnswerResult {
  answer: string
  sources: SearchResult[]
}

export async function answerQuestion(question: string, nResults = 3): Promise<AnswerResult> {
  const sources = await searchDocuments(RAG_COLLECTION, question, nResults)
  const context = buildContext(sources)
  const answer = await chatComplete(buildMessages(question, context))
  return { answer, sources }
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
function buildMessages(question: string, context: string): ChatMessage[] {
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
5. 두세 문장 안에 핵심만 정리하고, 자료에 없는 정보는 덧붙이지 마세요.`,
    },
    {
      role: "user",
      content: `다음 자료를 참고해서 질문에 답해 주세요.\n\n[자료]\n${context}\n\n[질문]\n${question}`,
    },
  ]
}
