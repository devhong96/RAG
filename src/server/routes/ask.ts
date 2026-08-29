import { Router } from "express"
import { answerQuestion } from "../../lib/rag.js"
import { errorMessage, sendError } from "./errors.js"

interface AskRequest {
  question: string
  nResults?: number
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

  try {
    const result = await answerQuestion(body.question, body.nResults ?? 3)
    res.json({
      question: body.question,
      answer: result.answer,
      sources: result.sources.map((s) => ({
        source: s.metadata?.source ?? "unknown",
        excerpt: s.document.slice(0, 100),
        distance: s.distance,
      })),
    })
  } catch (error) {
    sendError(res, 502, "answer_failed", "답변 생성 중 오류가 발생했습니다", errorMessage(error))
  }
})
