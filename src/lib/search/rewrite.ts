import type { Collection } from "chromadb"
import { chatComplete, type ChatMessage } from "../llm.js"
import { rrfMerge } from "./hybrid.js"

/**
 * 질의를 LLM 으로 다듬어 검색 품질을 올리는 기법들. (강의 31)
 *
 * 사용자가 던지는 질의는 구어체이거나 짧아서 임베딩이 잡기 어려울 때가 많다.
 * 검색 전에 질의 쪽을 손보면 인덱스를 건드리지 않고도 성능이 오른다.
 */

/** 구어체·군더더기를 걷어내고 핵심 명사를 남긴다. */
export async function rewriteQuery(original: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `사용자의 검색 질의를 벡터 검색에 더 잘 동작하도록 다듬는 작업만 하세요.
질문에 답하지 마세요. 예시나 목록을 만들지 마세요.
- 입력에 있는 핵심 명사만 남기고 구어체와 군더더기를 제거하세요.
- 입력에 없는 단어를 새로 만들어내지 마세요.
- 한국어로, 정확히 한 줄만 출력하세요. 설명·번호·불릿을 붙이지 마세요.

예) 입력: "음... 커피 원두 중에 좀 시큼한 거 뭐 있더라?"
    출력: 산미 강한 커피 원두`,
    },
    { role: "user", content: original },
  ]
  const rewritten = (await chatComplete(messages)).trim()
  return rewritten || original // 빈 응답 안전망
}

/**
 * HyDE (Hypothetical Document Embeddings).
 *
 * 질문을 그대로 검색하는 대신, LLM 에게 "가상의 답변"을 쓰게 하고
 * 그 답변으로 검색한다. 질문보다 답변이 문서와 어휘가 비슷하기 때문에 더 잘 걸린다.
 * 답변의 사실 여부는 중요하지 않다 — 검색용 미끼일 뿐이다.
 */
export async function hydeSearch(
  collection: Collection,
  question: string,
  nResults = 3,
): Promise<{ hypothetical: string; docs: string[] }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `다음 질문에 대한 답변을 한 문단으로 한국어로 작성하세요.
- 사실 여부는 중요하지 않고, 자연스러운 답변 형태가 중요합니다.
- 답변 외의 설명이나 메타 정보는 붙이지 마세요.`,
    },
    { role: "user", content: question },
  ]
  const hypothetical = (await chatComplete(messages)).trim()

  const result = await collection.query({
    queryTexts: [hypothetical || question], // 빈 응답 시 원본 질의로 fallback
    nResults,
    include: ["documents"] as const,
  })
  const docs = (result.documents?.[0] ?? []).filter((d): d is string => d !== null)

  return { hypothetical, docs }
}

/** 원본 질의를 여러 각도로 변형한다. */
export async function expandQueries(original: string, n = 4): Promise<string[]> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `원본 질의를 서로 다른 각도의 검색 질의 ${n}개로 변형하세요.
질문에 답하지 말고, 변형된 질의만 만드세요.
- 반드시 ${n}줄을 출력하세요.
- 각 줄에 질의 하나만 적고, 번호·불릿·설명을 붙이지 마세요.
- 한국어로 작성하세요.`,
    },
    { role: "user", content: original },
  ]
  const text = await chatComplete(messages)
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, n)
}

/**
 * Multi-Query Retrieval.
 * 변형 질의로 각각 검색한 뒤 RRF 로 합친다.
 * 하나의 질의로는 놓치는 문서를 다른 각도의 질의가 잡아준다.
 */
export async function multiQuerySearch(
  collection: Collection,
  original: string,
  topK = 5,
): Promise<string[]> {
  const variations = [original, ...(await expandQueries(original, 4))]
  const rankings: string[][] = []
  for (const q of variations) {
    const r = await collection.query({ queryTexts: [q], nResults: 10 })
    rankings.push(r.ids[0] ?? [])
  }
  return rrfMerge(rankings).slice(0, topK)
}
