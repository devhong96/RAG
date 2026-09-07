import { chatJson, type JsonSchema } from "../structured.js"
import type { ChatMessage } from "../llm.js"

/**
 * 심판형 LLM — 답변 품질을 숫자로 잰다. (패턴 17)
 *
 * [초보자 설명] 이 저장소의 평가(`metrics.ts`)는 지금까지 **검색만** 쟀다.
 * Recall@k 와 MRR 은 "정답 문서를 상위에 올렸는가"를 본다. 중요한 지표지만 반쪽이다.
 * RAG 는 검색 다음에 생성이 붙어 있고, 실제 사용자가 보는 건 생성된 답변이다.
 *
 *   검색은 맞았는데 답이 틀린 경우가 실제로 흔하다.
 *   - 자료에 "88~94도"라고 적혀 있는데 답변은 "90도 정도"라고 뭉갠다
 *   - 자료를 제대로 찾아놓고 학습 때 외운 다른 지식으로 답한다
 *   - 질문은 가공 방식을 물었는데 보관법을 설명한다
 *
 * Recall 은 이 셋 모두에서 만점이 나온다. 그래서 답변 자체를 채점할 방법이 필요하다.
 * 사람이 매번 읽는 건 규모가 안 나오니, **다른 LLM 에게 채점을 시킨다.**
 * 이게 심판형 LLM(LLM-as-a-judge)이다.
 *
 * 두 축으로 나눠 매긴다. 하나로 합치면 무엇이 문제인지 알 수 없기 때문이다.
 *   - 근거성(groundedness): 답변 내용이 준 자료 안에 있는가. 낮으면 지어낸 것이다
 *   - 관련성(relevance): 질문에 실제로 답했는가. 낮으면 딴소리를 한 것이다
 * 근거성은 높은데 관련성이 낮으면 "자료를 그대로 읊었지만 질문과 무관"한 경우이고,
 * 반대면 "말은 맞는데 근거가 없는" 경우다. 고칠 곳이 완전히 다르다.
 *
 * **한계를 분명히 하자.** 심판도 LLM 이라 틀린다. 자기가 쓴 답을 후하게 주는 경향
 * (자기 선호 편향)도 알려져 있다. 그래서 이 점수는 **절대 성적표가 아니라 비교용**이다.
 * "청킹을 바꿨더니 근거성 평균이 3.1에서 4.0으로 올랐다" 같은 상대 비교에 쓰고,
 * "우리 RAG 는 4.0점짜리"라고 말하는 데 쓰면 안 된다.
 *
 * 채점 결과를 JSON 으로 받아야 집계할 수 있으므로 구조화 출력(패턴 2)을 쓴다.
 * 프롬프트로 부탁만 하면 "4점입니다. 왜냐하면..." 같은 문장이 와서 평균을 못 낸다.
 */

export interface JudgeScore {
  /** 1~5. 답변이 제공된 자료에 근거하는가. */
  groundedness: number
  /** 1~5. 답변이 질문에 실제로 답하는가. */
  relevance: number
  /** 채점 이유 한 줄. 점수만 보면 왜 깎였는지 알 수 없다. */
  reason: string
}

const JUDGE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    // enum 으로 값을 다섯 개로 묶어두면 3.5 같은 소수나 범위를 벗어난 값이 아예 안 나온다.
    groundedness: { type: "integer", enum: [1, 2, 3, 4, 5] },
    relevance: { type: "integer", enum: [1, 2, 3, 4, 5] },
    reason: { type: "string" },
  },
  required: ["groundedness", "relevance", "reason"],
}

export interface JudgeInput {
  question: string
  answer: string
  /** 답변을 만들 때 실제로 넘겨준 자료들. */
  contexts: readonly string[]
}

/**
 * 답변 하나를 채점한다. 실패하면 null.
 *
 * 채점 기준을 프롬프트에 숫자별로 적어두는 게 중요하다. "잘 채점하세요"라고만 하면
 * 같은 답변에 3점을 줬다 5점을 줬다 한다. 기준이 구체적일수록 재현성이 올라간다.
 */
export async function judgeAnswer(input: JudgeInput): Promise<JudgeScore | null> {
  const context = input.contexts.map((c, i) => `[자료 ${i + 1}]\n${c}`).join("\n\n")

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 RAG 답변을 채점하는 평가자입니다. 답변을 새로 쓰지 말고 채점만 하세요.

[근거성] 답변의 내용이 제공된 자료 안에 있는가
  5: 모든 문장이 자료로 확인된다
  3: 대체로 자료에 있으나 자료에 없는 표현이나 일반 상식이 섞여 있다
  1: 자료와 무관하거나 자료에 없는 사실을 단정한다

[관련성] 답변이 질문에 실제로 답하는가
  5: 질문에 정면으로 답한다
  3: 관련은 있으나 질문의 일부만 답하거나 곁가지를 설명한다
  1: 질문과 다른 이야기를 한다

주의: 자료에 답이 없어 "제공된 자료로는 답할 수 없습니다"라고 답한 경우,
정직한 응답이므로 근거성은 5점으로, 관련성은 3점으로 매기세요.
답변 길이나 문체는 채점 대상이 아닙니다.`,
    },
    {
      role: "user",
      content: `[질문]\n${input.question}\n\n[제공된 자료]\n${context}\n\n[채점할 답변]\n${input.answer}`,
    },
  ]

  const score = await chatJson<JudgeScore>(messages, JUDGE_SCHEMA)
  if (!score) return null

  // 형식이 맞아도 값이 범위를 벗어날 수 있다. 집계 전에 걸러야 평균이 오염되지 않는다.
  if (!inRange(score.groundedness) || !inRange(score.relevance)) return null
  return score
}

function inRange(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
}

export interface JudgeSummary {
  /** 채점에 성공한 사례 수. */
  judged: number
  /** 채점에 실패해 집계에서 빠진 사례 수. */
  failed: number
  groundedness: number
  relevance: number
}

/**
 * 채점 결과 여러 개를 평균 낸다.
 *
 * 순수 함수로 떼어낸 이유는 두 가지다. LLM 없이 테스트할 수 있고,
 * "실패한 사례를 어떻게 셀 것인가"라는 정책을 한곳에서 볼 수 있다.
 * 실패를 0점으로 치면 모델이 느려서 시간 초과가 난 날의 점수가 폭락해
 * 전략 비교가 무의미해진다. 그래서 평균에서 빼고 실패 수를 따로 보고한다.
 * (failed 가 크면 그 실행의 평균은 신뢰하면 안 된다는 뜻이다)
 */
export function summarize(scores: readonly (JudgeScore | null)[]): JudgeSummary {
  const valid = scores.filter((s): s is JudgeScore => s !== null)
  const failed = scores.length - valid.length
  if (valid.length === 0) return { judged: 0, failed, groundedness: 0, relevance: 0 }

  const mean = (pick: (s: JudgeScore) => number) =>
    valid.reduce((sum, s) => sum + pick(s), 0) / valid.length

  return {
    judged: valid.length,
    failed,
    groundedness: mean((s) => s.groundedness),
    relevance: mean((s) => s.relevance),
  }
}
