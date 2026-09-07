import { chatJson, type JsonSchema } from "./structured.js"
import type { ChatMessage } from "./llm.js"

/**
 * 질의 라우팅 - 에이전트형 작업흐름의 가장 작은 형태. (패턴 25 계열)
 *
 * [초보자 설명] "에이전트"라고 하면 보통 모델이 도구를 여러 개 쥐고 스스로 계획을 세워
 * 여러 단계를 도는 그림을 떠올린다. 그건 이 저장소에 아직 이르다.
 * 답이 틀렸을 때 검색이 잘못된 건지, 도구 선택이 잘못된 건지, 계획이 잘못된 건지
 * 분리가 안 되기 때문이다.
 *
 * 그래서 **한 단계만** 남긴다. 도구를 고르는 것까지만 모델에게 맡기고, 실행은 코드가 한다.
 *
 *   질문 -> [라우터] -> vector : 문서 내용을 묻는 질문   -> 기존 RAG
 *                    -> graph  : 관계를 묻는 질문        -> GraphRAG
 *                    -> none   : 자료가 필요 없는 질문   -> 바로 답변
 *
 * 이 한 단계만으로도 에이전트의 핵심 어려움이 그대로 드러난다.
 * **선택이 틀렸을 때 그 뒤가 전부 틀린다.** 관계 질문을 vector 로 보내면
 * 검색은 성공했는데 답이 엉뚱해지고, 로그만 봐서는 검색 탓인지 라우팅 탓인지 모른다.
 * 그래서 라우터는 고른 이유(reason)를 반드시 함께 남긴다. 이게 실무 에이전트에서
 * 계획을 로그로 남기는 이유와 같다.
 *
 * 왜 "자료가 필요 없는 질문"까지 나눠 두는가? RAG 는 모든 질문에 검색을 붙인다.
 * "안녕하세요"에도 벡터 검색이 한 번 돈다. 관련 없는 청크 세 개가 컨텍스트로 들어가
 * 답을 오히려 이상하게 만든다. **검색을 건너뛰는 것도 선택지**여야 한다.
 */

export type Route = "vector" | "graph" | "none"

export interface RoutePlan {
  route: Route
  /** 고른 이유 한 줄. 라우팅이 틀렸을 때 어디서 어긋났는지 보려면 이게 있어야 한다. */
  reason: string
}

const ROUTE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    // 구조화 출력(패턴 2)을 그대로 재사용한다. enum 으로 묶으면 "vector 인 것 같습니다"
    // 같은 문장이 아예 나올 수 없다.
    route: { type: "string", enum: ["vector", "graph", "none"] },
    reason: { type: "string" },
  },
  required: ["route", "reason"],
}

/** 관계를 묻는 질문에 자주 나오는 표현. 그래프 탐색이 유리한 신호다. */
const GRAPH_HINTS: readonly RegExp[] = [
  /관계|관련성|연결|이어지|영향|사이/,
  /누가\s*(만들|개발|설립|창업)/,
  /어디\s*(소속|속해)/,
  /무엇을?\s*(사용|채택)하/,
]

/** 자료를 볼 필요가 없는 말. 인사나 메타 질문이다. */
const SMALL_TALK: readonly RegExp[] = [
  /^\s*(안녕|반가|고마워|감사|잘\s*가|테스트)/,
  /^\s*(넌|너는|당신은)\s*(누구|뭐)/,
]

/**
 * LLM 없이 규칙만으로 경로를 고른다.
 *
 * 순수 함수라 테스트가 쉽고, LLM 호출이 실패했을 때의 대비책이기도 하다.
 * 규칙 기반은 표현이 조금만 달라져도 놓치므로 정확도는 낮다.
 * 그래도 **"라우터가 죽으면 전부 죽는다"를 막는 것**이 목적이라 이 정도면 된다.
 * (라우팅이 실패했을 때 기본값을 vector 로 둔 이유: 이 저장소에서 가장 흔한 질문 유형이고,
 *  잘못 골라도 검색 결과가 비어 있을 뿐 위험한 동작으로 이어지지 않는다)
 */
export function heuristicRoute(question: string): RoutePlan {
  const text = question.trim()
  if (SMALL_TALK.some((p) => p.test(text))) {
    return { route: "none", reason: "인사나 메타 질문이라 자료가 필요 없습니다" }
  }
  if (GRAPH_HINTS.some((p) => p.test(text))) {
    return { route: "graph", reason: "개체 사이의 관계를 묻는 표현이 있습니다" }
  }
  return { route: "vector", reason: "문서 내용을 묻는 일반 질문으로 봤습니다" }
}

/**
 * LLM 에게 경로를 고르게 한다. 실패하면 규칙 기반으로 물러선다.
 *
 * 규칙 기반이 있는데도 LLM 을 쓰는 이유는 표현의 다양성 때문이다.
 * "에티오피아 원두랑 케냐 원두 중에 뭐가 더 산미가 강해?"에는 관계 어휘가 하나도 없지만
 * 실제로는 두 개체를 비교하는 질문이다. 규칙으로는 이런 걸 계속 놓친다.
 */
export async function planRoute(question: string): Promise<RoutePlan> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 질문을 알맞은 검색 방법으로 보내는 라우터입니다. 질문에 답하지 말고 분류만 하세요.

vector: 문서에 적힌 내용을 묻는 질문. 정의, 설명, 수치, 방법 등
graph: 개체와 개체 사이의 관계를 묻는 질문. 누가 무엇을 만들었는지, 무엇이 무엇에 연결되는지
none: 자료를 찾을 필요가 없는 질문. 인사, 잡담, 당신 자신에 대한 질문

애매하면 vector 를 고르세요. reason 에는 그렇게 고른 근거를 한 문장으로 적으세요.`,
    },
    { role: "user", content: question },
  ]

  const plan = await chatJson<RoutePlan>(messages, ROUTE_SCHEMA)
  if (!plan || !isRoute(plan.route)) return heuristicRoute(question)
  return { route: plan.route, reason: plan.reason ?? "" }
}

function isRoute(value: unknown): value is Route {
  return value === "vector" || value === "graph" || value === "none"
}

/** 사람이 읽을 한 줄. 데모 로그에 쓴다. */
export function describeRoute(plan: RoutePlan): string {
  const label: Record<Route, string> = {
    vector: "벡터 검색 RAG",
    graph: "그래프 탐색 GraphRAG",
    none: "검색 없이 바로 답변",
  }
  return `${label[plan.route]} (${plan.reason})`
}
