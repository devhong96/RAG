import { chatComplete, type ChatMessage } from "./llm.js"

/**
 * 멀티턴(여러 번 주고받는) 대화 RAG.
 *
 * [초보자 설명] 지금까지의 `answerQuestion` 은 질문 하나를 받아 답 하나를 돌려주는
 * 단발성 함수였다. 그런데 사람은 실제로 이렇게 묻는다.
 *
 *   사용자: "셀프 어텐션이 뭔가요?"
 *   AI:     "셀프 어텐션은 ... 입니다."
 *   사용자: "그거 왜 필요한데요?"        <- "그거"가 뭔지 이 문장만 봐서는 알 수 없다
 *
 * 세 번째 줄을 그대로 벡터 검색에 넣으면 "그거 왜 필요한데요"라는 글과 비슷한 문서를 찾는다.
 * 당연히 엉뚱한 결과가 나온다. 검색은 이전 대화를 모르기 때문이다.
 *
 * 해결책은 두 단계로 나누는 것이다.
 *   1. 질문 압축(condense): 대화 기록을 참고해 "혼자서도 말이 되는 질문"으로 다시 쓴다.
 *      "그거 왜 필요한데요?" -> "셀프 어텐션이 왜 필요한가?"
 *   2. 그 압축된 질문으로 평소처럼 검색하고 답변을 만든다.
 *
 * 답변 생성 단계에는 원래 질문과 대화 기록을 함께 넘긴다. 그래야 말투와 맥락이 이어진다.
 * 즉 "검색에는 압축한 질문, 생성에는 원래 대화"를 쓰는 것이 핵심이다.
 *
 * [자바 노트] 세션 저장소를 Map 으로 두는 것은 스프링의 인메모리 HttpSession 과 같다.
 *            프로세스가 죽으면 사라지므로 실제 서비스라면 Redis 등으로 옮겨야 한다.
 */

/** 한 세션이 기억할 최대 대화 수(사용자+AI 한 쌍 = 1턴). */
export const MAX_TURNS = 5

/**
 * 대화 기록에서 최근 N턴만 남긴다.
 *
 * [초보자 설명] 왜 잘라내야 하나?
 * 대화가 길어질수록 LLM 에 넘기는 글자 수가 계속 늘어난다. 컨텍스트 윈도(한 번에 넣을 수 있는
 * 길이)에는 한계가 있고, 길수록 느리고 비싸다. 게다가 20턴 전의 잡담은 지금 질문을 이해하는 데
 * 도움이 안 되면서 모델의 주의만 분산시킨다. 그래서 최근 것만 남기는 게 보통이다.
 *
 * 짝수 개(사용자/AI 쌍)로 자르는 이유는, 홀수로 자르면 AI 답변만 덩그러니 남아
 * 무슨 질문에 대한 답인지 알 수 없는 조각이 생기기 때문이다.
 */
export function trimHistory(history: readonly ChatMessage[], maxTurns = MAX_TURNS): ChatMessage[] {
  const limit = maxTurns * 2
  return history.length <= limit ? [...history] : history.slice(history.length - limit)
}

/**
 * 대화 기록을 프롬프트에 넣을 여러 줄 문자열로 만든다.
 * 순수 함수라 외부 서비스 없이 테스트할 수 있다.
 */
export function formatHistory(history: readonly ChatMessage[]): string {
  return history
    .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
    .join("\n")
}

/**
 * 대화 기록을 참고해 질문을 "혼자서도 말이 되는 질문"으로 다시 쓴다. (질문 압축)
 *
 * 기록이 비어 있으면 LLM 을 부르지 않고 원문을 그대로 돌려준다.
 * 첫 질문은 애초에 지시대명사가 없으므로 압축할 것이 없고, 괜히 호출하면 느리기만 하다.
 */
export async function condenseQuestion(
  history: readonly ChatMessage[],
  question: string,
): Promise<string> {
  if (history.length === 0) return question

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `대화 기록을 참고해서, 마지막 질문을 그 자체로 이해되는 독립적인 검색 질의로 다시 쓰세요.
질문에 답하지 마세요.
- "그거", "그것", "위에서 말한" 같은 지시어를 대화에서 가리키는 실제 단어로 바꾸세요.
- 대화에 없는 내용을 새로 지어내지 마세요.
- 마지막 질문이 이미 독립적이면 그대로 출력하세요.
- 한국어로, 정확히 한 줄만 출력하세요.`,
    },
    {
      role: "user",
      content: `[대화 기록]\n${formatHistory(history)}\n\n[마지막 질문]\n${question}`,
    },
  ]

  // LLM 이 빈 문자열이나 여러 줄을 뱉을 수 있다. 첫 줄만 쓰고, 비면 원문으로 되돌린다.
  // 압축에 실패했을 때 검색을 아예 못 하는 것보다는 원문으로라도 검색하는 편이 낫다.
  const condensed = (await chatComplete(messages)).trim().split("\n")[0]?.trim()
  return condensed || question
}

/**
 * 세션별 대화 기록 저장소 (인메모리).
 *
 * 실제 서비스라면 Redis 나 DB 로 옮겨야 하지만, 학습 예제에서는 Map 으로 충분하다.
 * 서버를 재시작하면 기록이 사라진다는 점만 기억하면 된다.
 */
export class ConversationStore {
  private readonly sessions = new Map<string, ChatMessage[]>()

  constructor(private readonly maxTurns = MAX_TURNS) {}

  get(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) ?? []
  }

  /** 사용자 질문과 AI 답변을 한 쌍으로 덧붙이고, 오래된 것은 잘라낸다. */
  append(sessionId: string, question: string, answer: string): void {
    const next = [
      ...this.get(sessionId),
      { role: "user", content: question } as const,
      { role: "assistant", content: answer } as const,
    ]
    this.sessions.set(sessionId, trimHistory(next, this.maxTurns))
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /** 현재 살아 있는 세션 수. 상태 점검용. */
  get size(): number {
    return this.sessions.size
  }
}
