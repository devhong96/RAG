import type { Collection } from "chromadb"
import { chatComplete, type ChatMessage } from "../llm.js"

/**
 * Self-Querying. (강의 32)
 *
 * "2024년 이후 커피 글 중 산미 강한 거" 같은 질의에는
 * 의미 검색으로 풀 부분("산미 강한")과 메타데이터 필터로 풀 부분("2024년 이후", "커피")이
 * 섞여 있다. LLM 에게 그 둘을 분리시킨다.
 */
export interface MetadataField {
  type: "string" | "number" | "boolean"
  enum?: readonly string[]
  description?: string
}

export interface ExtractedFilter {
  cleanedQuestion: string
  where: Record<string, unknown> | null
}

/**
 * LLM 이 만든 where 를 Chroma 문법으로 맞춘다.
 *
 * Chroma 는 최상위에 연산자가 정확히 하나여야 한다.
 * { category: "coffee", year: { $gte: 2024 } } 처럼 필드가 둘이면
 * "Expected 'where' to have exactly one operator, but got 2" 로 거부당한다.
 * $and 로 감싸주면 통과한다.
 *
 * [초보자 설명] 단순히 모든 키를 $and 로 감싸면 될 것 같지만 한 가지 함정이 있다.
 * LLM 이 이미 $and 를 쓴 채로 필드를 덧붙여 오는 경우가 있다.
 *   { $and: [{a: 1}], b: 2 }
 * 이걸 그대로 감싸면 $and 안에 $and 가 또 들어간 이상한 모양이 된다.
 *   { $and: [ { $and: [{a: 1}] }, { b: 2 } ] }   ← 불필요하게 중첩됨
 * 그래서 이미 있는 $and 의 내용물은 껍데기를 벗겨서 같은 층에 펼쳐 넣는다.
 *   { $and: [ {a: 1}, {b: 2} ] }                 ← 원하는 모양
 * ($or 는 의미가 달라서 펼치면 안 된다. 통째로 하나의 조건으로 넣는다.)
 */
export function normalizeWhere(
  where: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!where) return null

  const keys = Object.keys(where)
  if (keys.length === 0) return null

  // 조건들을 한 층으로 펼쳐 모은다.
  const conditions: unknown[] = []
  for (const key of keys) {
    const value = where[key]
    if (key === "$and" && Array.isArray(value)) {
      // 이미 $and 인 것은 껍데기를 벗겨 내용물만 꺼낸다 (중첩 방지).
      conditions.push(...value)
    } else {
      conditions.push({ [key]: value })
    }
  }

  if (conditions.length === 0) return null
  // 조건이 하나뿐이면 $and 로 감쌀 필요가 없다.
  if (conditions.length === 1) return conditions[0] as Record<string, unknown>
  return { $and: conditions }
}

export async function extractFilter(
  question: string,
  schema: Record<string, MetadataField>,
): Promise<ExtractedFilter> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `사용자 질의에서 메타데이터 필터를 추출하세요.
가능한 필드: ${JSON.stringify(schema)}
출력 형식: { "cleanedQuestion": "...", "where": { ... } }
where는 ChromaDB의 where 문법($eq, $gt, $gte, $lt, $lte, $in, $and, $or)을 따릅니다.
필터가 없으면 where를 null로 설정하세요.
설명 없이 JSON만 출력하세요.`,
    },
    { role: "user", content: question },
  ]

  const text = await chatComplete(messages)
  try {
    // [자바 노트] LLM 출력은 신뢰할 수 없는 외부 입력이다.
    //            잭슨처럼 스키마를 강제해주지 않으므로 파싱 실패를 반드시 감싸야 한다.
    // LLM 이 ```json 펜스를 붙이는 경우가 잦아서 걷어낸다
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim()
    const parsed = JSON.parse(cleaned) as Partial<ExtractedFilter>
    return {
      cleanedQuestion: parsed.cleanedQuestion ?? question,
      where: normalizeWhere(parsed.where ?? null),
    }
  } catch {
    // LLM 출력은 신뢰할 수 없다. 파싱 실패하면 필터 없이 진행한다.
    return { cleanedQuestion: question, where: null }
  }
}

export async function selfQuerySearch(
  collection: Collection,
  question: string,
  schema: Record<string, MetadataField>,
  nResults = 3,
) {
  const { cleanedQuestion, where } = await extractFilter(question, schema)
  console.log("정제된 질의:", cleanedQuestion)
  console.log("추출된 필터:", where)

  const base = {
    queryTexts: [cleanedQuestion],
    nResults,
    // as const 를 쓰면 readonly 가 되어 query() 의 Include[] 와 맞지 않는다
    include: ["documents", "metadatas"] as ("documents" | "metadatas")[],
  }

  try {
    return await collection.query(where ? { ...base, where: where as never } : base)
  } catch (error) {
    // LLM 이 만든 where 가 문법에 안 맞을 수 있다. 필터를 버리고 재시도.
    if (where) {
      console.log("필터 형식 오류, 필터 없이 재시도")
      return await collection.query(base)
    }
    throw error
  }
}
