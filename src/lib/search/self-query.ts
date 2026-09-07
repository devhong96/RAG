import type { Collection } from "chromadb"
import type { ChatMessage } from "../llm.js"
import { chatJson, type JsonSchema } from "../structured.js"

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

/**
 * 필터 추출 결과의 스키마. (패턴 2 - 문법)
 *
 * where 를 스키마로 못 박지 않고 문자열로 받는 이유가 있다.
 * Chroma 의 where 문법은 중첩이 자유로워($and 안에 $or, 그 안에 또 조건) JSON 스키마로
 * 정확히 표현하기 어렵다. 억지로 표현하면 스키마가 거대해지고, 그 스키마를 지키느라
 * 모델이 오히려 단순한 필터도 못 만든다.
 * 그래서 "겉모양(두 필드가 반드시 있고, where 는 JSON 문자열)"만 강제하고
 * 안쪽 내용은 기존처럼 파싱 후 normalizeWhere 로 다듬는다.
 * 형식 보장을 어디까지 가져갈지는 이렇게 비용을 보고 정하는 판단이다.
 */
const FILTER_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    cleanedQuestion: {
      type: "string",
      description: "필터 조건을 걷어낸, 의미 검색에 쓸 질의",
    },
    where: {
      type: "string",
      description: 'ChromaDB where 조건을 담은 JSON 문자열. 필터가 없으면 빈 문자열',
    },
  },
  required: ["cleanedQuestion", "where"],
}

interface RawFilter {
  cleanedQuestion?: string
  where?: string
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
where 는 ChromaDB where 문법($eq, $gt, $gte, $lt, $lte, $in, $and, $or)을 따르는
JSON 을 "문자열로" 담으세요. 예: "{\"year\": {\"$gte\": 2024}}"
필터로 옮길 조건이 없으면 where 를 빈 문자열로 두세요.
cleanedQuestion 에는 필터로 옮긴 조건을 뺀 나머지 질의만 남기세요.`,
    },
    { role: "user", content: question },
  ]

  // 문법으로 형식을 강제하므로 "JSON 이 아예 아닌" 실패는 사라진다.
  // 그래도 null 검사를 남긴다. 형식이 맞아도 내용이 비어 있을 수 있고,
  // 문법 지원이 없는 모델로 바꿔 끼울 수도 있기 때문이다.
  const parsed = await chatJson<RawFilter>(messages, FILTER_SCHEMA)
  if (!parsed) return { cleanedQuestion: question, where: null }

  return {
    cleanedQuestion: parsed.cleanedQuestion?.trim() || question,
    where: normalizeWhere(parseWhere(parsed.where)),
  }
}

/**
 * where 문자열을 객체로 바꾼다. 비었거나 망가졌으면 null(필터 없음)로 본다.
 *
 * 순수 함수라 LLM 없이 테스트할 수 있다. 이 저장소가 로직을 쪼갤 때 쓰는 기준이
 * "외부 호출 없이 검증 가능한가"이고, 여기서도 같은 기준을 적용했다.
 */
export function parseWhere(raw: string | undefined): Record<string, unknown> | null {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === "null" || trimmed === "{}") return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
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
