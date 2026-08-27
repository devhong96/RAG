import { Router } from "express"
import { ingestDocument } from "../../lib/documents.js"
import { RAG_COLLECTION } from "../../lib/rag.js"
import { errorMessage, sendError } from "./errors.js"

interface IngestRequest {
  source: string
  text: string
  metadata?: Record<string, unknown>
}

export const documentsRouter = Router()

documentsRouter.post("/documents", async (req, res) => {
  const body = req.body as IngestRequest

  if (!body.source || typeof body.source !== "string") {
    sendError(res, 400, "invalid_source", "source는 필수 문자열입니다")
    return
  }
  if (!body.text || typeof body.text !== "string" || body.text.trim() === "") {
    sendError(res, 400, "invalid_text", "text는 비어 있지 않은 문자열이어야 합니다")
    return
  }

  try {
    const result = await ingestDocument(RAG_COLLECTION, body)
    res.json({ source: body.source, chunkCount: result.chunkCount, ids: result.ids })
  } catch (error) {
    sendError(res, 502, "ingest_failed", "인제스트 처리 중 오류가 발생했습니다", errorMessage(error))
  }
})
