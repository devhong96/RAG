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
  // Content-Type 이 없으면 express.json() 이 본문을 건드리지 않아 req.body 가 undefined 다.
  // 그대로 두면 아래 검증에서 TypeError 가 나 400 이어야 할 요청이 500 으로 나간다.
  const body = (req.body ?? {}) as IngestRequest

  if (!body.source || typeof body.source !== "string" || body.source.trim() === "") {
    sendError(res, 400, "invalid_source", "source는 필수 문자열입니다")
    return
  }
  if (!body.text || typeof body.text !== "string" || body.text.trim() === "") {
    sendError(res, 400, "invalid_text", "text는 비어 있지 않은 문자열이어야 합니다")
    return
  }
  // interface는 런타임에 사라지므로 metadata: [] 같은 JSON도 별도 검사가 없으면 통과한다.
  // 여기서는 우선 "일반 객체인가"를 확인하고, 저장 가능한 값 형식은 Chroma가 최종 검증한다.
  if (body.metadata !== undefined && (!body.metadata || typeof body.metadata !== "object" || Array.isArray(body.metadata))) {
    sendError(res, 400, "invalid_metadata", "metadata는 객체여야 합니다")
    return
  }

  try {
    const source = body.source.trim()
    const result = await ingestDocument(RAG_COLLECTION, { ...body, source })
    // stats 를 함께 돌려주면 같은 문서를 다시 올렸을 때 실제로 몇 개만 다시 임베딩됐는지
    // 응답만 보고 확인할 수 있다. (증분 인덱싱이 동작하는지 눈으로 보는 가장 쉬운 방법)
    res.json({ source, chunkCount: result.chunkCount, ids: result.ids, stats: result.stats })
  } catch (error) {
    sendError(res, 502, "ingest_failed", "인제스트 처리 중 오류가 발생했습니다", errorMessage(error))
  }
})
