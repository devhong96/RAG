import { chatComplete, type ChatMessage } from "./llm.js"

/**
 * 구조화 출력 — LLM 에게 "정해진 모양의 JSON"만 뱉게 한다. (패턴 2: 문법)
 *
 * [초보자 설명] RAG 를 만들다 보면 LLM 에게 문장이 아니라 **데이터**를 시켜야 할 때가 있다.
 * 이 저장소만 해도 두 군데다.
 *   - Self-Query: 질의에서 메타데이터 필터를 뽑아 `{ where: {...} }` 로 받아야 한다
 *   - 심판형 LLM: 답변을 채점해서 `{ groundedness: 4, ... }` 로 받아야 한다
 *
 * 예전 방식은 프롬프트에 "설명 없이 JSON만 출력하세요"라고 적는 것이었다.
 * 이건 부탁이라 자주 깨진다. 실제로 자주 보는 실패는 이렇다.
 *   - 앞뒤에 "물론이죠! 아래는 요청하신 JSON입니다." 를 붙인다
 *   - ```json 펜스로 감싼다
 *   - 필드 이름을 제멋대로 바꾼다 (where -> filter)
 *   - 숫자를 문자열로 준다 ("4")
 *
 * 그래서 파싱 실패를 try/catch 로 감싸고 실패하면 기능을 포기하는 코드가 붙어 있었다.
 * 즉 **LLM 기분에 따라 기능이 조용히 꺼지는** 상태였다.
 *
 * 문법(grammar) 방식은 접근이 다르다. JSON 스키마를 모델에게 넘기면, 토큰을 하나 고를 때마다
 * **스키마에 맞지 않는 후보를 아예 제외**한다. 형식이 어긋난 출력이 만들어질 길 자체가 막힌다.
 * 부탁이 아니라 제약이라, 프롬프트를 잘 쓰는 문제에서 형식이 보장되는 문제로 성격이 바뀐다.
 *
 * 남는 위험은 "형식은 맞지만 내용이 틀린" 경우다. 그건 문법으로 못 막으니
 * 아래 `chatJson` 도 여전히 실패 시 null 을 돌려주고, 호출부가 대안을 갖게 한다.
 *
 * [자바 노트] 잭슨이 응답 JSON 을 DTO 로 역직렬화해주는 것과 목적은 비슷하지만 시점이 다르다.
 *            잭슨은 "이미 만들어진 문자열"을 검사하고, 이건 "만들어지는 중"에 제약한다.
 */

/**
 * JSON 스키마를 아주 얇게 표현한 타입.
 *
 * 전체 스펙을 다 담지 않고 이 저장소가 실제로 쓰는 부분만 둔다.
 * 어설프게 전부 흉내 내면 타입만 복잡해지고 얻는 게 없다.
 */
export interface JsonSchema {
  type: "object" | "string" | "number" | "integer" | "boolean" | "array"
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  /** 반드시 있어야 하는 필드. 여기 없으면 모델이 필드를 통째로 빠뜨릴 수 있다. */
  required?: string[]
  /** 값을 이 목록 안에서만 고르게 한다. */
  enum?: readonly (string | number)[]
  description?: string
  minimum?: number
  maximum?: number
}

/**
 * 코드 펜스를 걷어낸다.
 *
 * 문법을 쓰면 펜스가 붙을 일이 없지만, 문법을 지원하지 않는 모델로 갈아끼웠을 때를 대비해
 * 남겨 둔다. 안전망은 있으면 거의 안 걸리고 없으면 반드시 걸린다.
 */
export function stripCodeFence(text: string): string {
  return text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim()
}

/**
 * 스키마에 맞는 JSON 을 받아 파싱한다. 실패하면 null 을 돌려준다.
 *
 * 예외를 던지지 않고 null 을 주는 이유: 이 함수를 쓰는 곳(필터 추출, 답변 채점)은
 * 전부 "실패해도 전체가 멈추면 안 되는" 보조 기능이다. 필터 추출이 실패하면 필터 없이
 * 검색하면 되고, 채점이 실패하면 그 사례만 빼고 집계하면 된다.
 * 호출부가 그 판단을 하도록 실패를 값으로 돌려준다.
 *
 * [자바 노트] Optional<T> 를 반환하는 것과 같은 발상이다.
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  schema: JsonSchema,
  options: { temperature?: number; timeoutMs?: number } = {},
): Promise<T | null> {
  const text = await chatComplete(messages, { ...options, format: schema as unknown as Record<string, unknown> })
  try {
    return JSON.parse(stripCodeFence(text)) as T
  } catch {
    return null
  }
}
