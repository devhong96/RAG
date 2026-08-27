import { Router } from "express"
import { answerQuestion } from "../../lib/rag.js"
import { errorMessage, sendError } from "./errors.js"

interface AskRequest {
  question: string
  nResults?: number
}

export const askRouter = Router()

askRouter.post("/ask", async (req, res) => {
  const body = req.body as AskRequest

  if (!body.question || typeof body.question !== "string" || body.question.trim() === "") {
    sendError(res, 400, "invalid_question", "question은 비어 있지 않은 문자열이어야 합니다")
    return
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
