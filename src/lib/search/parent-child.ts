import type { Collection } from "chromadb"
import { chatComplete, type ChatMessage } from "../llm.js"

/**
 * Parent-Child Retrieval. (강의 27, 32)
 *
 * 검색은 작은 청크(자식)로 해야 정확하고, 답변은 큰 청크(부모)로 해야 맥락이 산다.
 * 자식으로 찾고 → 부모를 꺼내서 → 부모를 LLM 에 넘긴다.
 */

/** 컨텍스트가 LLM 입력 한도를 넘지 않게 앞에서부터 자른다. */
export function trimContext(docs: string[], maxChars = 4000): string[] {
  const result: string[] = []
  let used = 0
  for (const doc of docs) {
    if (used + doc.length > maxChars) break
    result.push(doc)
    used += doc.length
  }
  return result
}

export interface ParentChildResult {
  context: string
  childIds: string[]
  parentIds: string[]
}

export async function parentChildSearch(
  childCollection: Collection,
  parentCollection: Collection,
  question: string,
  nChild = 5,
  maxChars = 4000,
): Promise<ParentChildResult> {
  const childHit = await childCollection.query({
    queryTexts: [question],
    nResults: nChild,
    include: ["documents", "metadatas"] as const,
  })

  const childIds = childHit.ids[0] ?? []
  const parentIds = [
    ...new Set(
      (childHit.metadatas?.[0] ?? [])
        .map((m) => m?.parentId)
        // [자바 노트] "(id): id is string" 은 타입 가드다.
        //            filter 를 통과한 값이 string 임을 컴파일러에게 알려준다.
        //            이게 없으면 결과가 (string|undefined)[] 로 남는다.
        .filter((id): id is string => typeof id === "string"),
    ),
  ]

  const parents = await parentCollection.get({ ids: parentIds })
  const docs = trimContext(
    (parents.documents ?? []).filter((d): d is string => d !== null),
    maxChars,
  )
  const context = docs.map((d, i) => `[자료 ${i + 1}]\n${d}`).join("\n\n")

  return { context, childIds, parentIds }
}

/** 자료를 근거로만 답하게 하는 기본 RAG 프롬프트. */
export async function answerFromContext(context: string, question: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        '주어진 자료를 바탕으로 한국어로 답하세요. 자료에 없으면 "제공된 자료로는 답할 수 없습니다"라고 답하세요.',
    },
    { role: "user", content: `자료:\n${context}\n\n질문: ${question}` },
  ]
  return await chatComplete(messages)
}
