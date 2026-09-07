import { Router } from "express"
import { checkQuestion, maskPii } from "../../lib/guardrails.js"
import { answerInConversation, answerQuestion, conversations } from "../../lib/rag.js"
import { errorMessage, sendError } from "./errors.js"

interface AskRequest {
  question: string
  nResults?: number
  /**
   * 있으면 그 세션의 대화 맥락을 이어서 답한다. 없으면 기존처럼 단발 질의로 처리한다.
   * 클라이언트가 아무 문자열이나 정해서 보내면 되고, 서버는 그 값으로 기록을 모아둔다.
   */
  sessionId?: string
}

export const askRouter = Router()

askRouter.post("/ask", async (req, res) => {
  // [초보자 설명] express.json() 은 요청 헤더에 Content-Type: application/json 이 있을 때만
  // 본문을 파싱한다. 헤더 없이 POST 가 오면 req.body 는 아예 undefined 로 남는다.
  // 그 상태로 body.question 을 읽으면 "undefined 의 속성을 읽을 수 없다"는 TypeError 가 나고,
  // 그 에러가 에러 핸들러로 넘어가 500(서버 잘못)으로 응답된다.
  // 하지만 이건 요청을 잘못 보낸 쪽 문제이므로 400(요청 잘못)이 맞다.
  // ?? {} 로 빈 객체를 깔아주면 아래 검증이 정상적으로 400 을 돌려준다.
  const body = (req.body ?? {}) as AskRequest

  if (!body.question || typeof body.question !== "string" || body.question.trim() === "") {
    sendError(res, 400, "invalid_question", "question은 비어 있지 않은 문자열이어야 합니다")
    return
  }
  // [초보자 설명] 위의 AskRequest 인터페이스에 nResults?: number 라고 적어두긴 했지만,
  // TypeScript 의 타입은 컴파일하면 사라진다. 런타임에는 아무 JSON 이나 들어올 수 있어서
  // 스프링의 @Valid 처럼 자동으로 걸러주지 않는다. 직접 검사해야 한다.
  // 검사가 없으면 nResults: "99999" 같은 문자열이나 천만 같은 수가 그대로 Chroma 로 넘어가
  // 엉뚱한 에러가 나거나 DB 에 과한 부하를 준다. /search 와 같은 1~50 범위로 맞춘다.
  if (body.nResults !== undefined) {
    if (typeof body.nResults !== "number" || !Number.isInteger(body.nResults) || body.nResults < 1 || body.nResults > 50) {
      sendError(res, 400, "invalid_n_results", "nResults는 1과 50 사이의 정수여야 합니다")
      return
    }
  }

  // 가드레일은 경계에 둔다. 이 라우트가 신뢰할 수 없는 입력이 들어오는 유일한 문이므로,
  // RAG 로직 안이 아니라 여기서 막는다. (검사 로직 자체는 lib/guardrails.ts)
  const verdict = checkQuestion(body.question)
  if (!verdict.ok) {
    sendError(res, 400, verdict.code ?? "rejected", verdict.message ?? "처리할 수 없는 질문입니다")
    return
  }

  // sessionId 는 Map 의 키로 쓰이므로 형식을 확인한다. 숫자나 객체가 들어오면
  // 키가 "[object Object]" 같은 값이 되어 서로 다른 사용자의 대화가 한 세션에 섞인다.
  if (body.sessionId !== undefined) {
    if (typeof body.sessionId !== "string" || body.sessionId.trim() === "" || body.sessionId.length > 100) {
      sendError(res, 400, "invalid_session_id", "sessionId는 1~100자 문자열이어야 합니다")
      return
    }
  }

  try {
    const sessionId = body.sessionId?.trim()
    const nResults = body.nResults ?? 3
    const result = sessionId
      ? await answerInConversation(sessionId, body.question, nResults)
      : await answerQuestion(body.question, nResults)
    res.json({
      question: body.question,
      // 대화형일 때만 붙는다. 지시어가 무엇으로 풀렸는지 확인할 수 있어 디버깅에 요긴하다.
      ...("searchQuery" in result ? { searchQuery: result.searchQuery } : {}),
      // 나가는 쪽 가드레일. 적재한 문서에 섞여 있던 개인정보가 답변이나 발췌를 타고
      // 밖으로 나가는 경로를 여기서 한 번 더 막는다.
      answer: maskPii(result.answer),
      sources: result.sources.map((s) => ({
        source: s.metadata?.source ?? "unknown",
        excerpt: maskPii(s.document.slice(0, 100)),
        distance: s.distance,
      })),
    })
  } catch (error) {
    sendError(res, 502, "answer_failed", "답변 생성 중 오류가 발생했습니다", errorMessage(error))
  }
})

/**
 * 대화 기록을 비운다. 화제를 완전히 바꿀 때 쓴다.
 *
 * [초보자 설명] 왜 필요한가? 질문 압축은 이전 대화를 참고하므로, 앞의 화제가 남아 있으면
 * 전혀 다른 새 질문까지 예전 주제로 끌어당겨 해석할 수 있다. 대화 UI 의 "새 대화" 버튼 자리다.
 */
askRouter.delete("/sessions/:sessionId", (req, res) => {
  conversations.clear(req.params.sessionId)
  res.json({ sessionId: req.params.sessionId, cleared: true })
})
