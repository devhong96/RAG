// [자바 노트] Router 는 @RestController 하나에 대응한다.
import { Router } from "express"
import { searchDocuments } from "../../lib/documents.js"
import { RAG_COLLECTION } from "../../lib/rag.js"
import { errorMessage, sendError } from "./errors.js"

/**
 * [자바 노트] 요청 DTO 자리. 하지만 자바와 결정적으로 다른 점이 있다.
 * 이 interface 는 컴파일하면 사라진다. 런타임에는 존재하지 않는다.
 * 따라서 @Valid, @NotNull 같은 자동 검증이 불가능하고, 아래처럼 손으로 검사해야 한다.
 */
interface SearchRequest {
  query: string
  nResults?: number
  where?: Record<string, unknown> // [자바 노트] ≒ Map<String, Object>
}

export const searchRouter = Router()

// [자바 노트] @PostMapping("/search") 에 해당한다.
//            (req, res) 는 (HttpServletRequest, HttpServletResponse) 자리.
searchRouter.post("/search", async (req, res) => {
  // [자바 노트] as 는 "이 타입이라고 치자"일 뿐 검사하지 않는다.
  //            실제로는 아무 JSON 이나 들어올 수 있다. 그래서 바로 아래에서 검증한다.
  const body = req.body as SearchRequest

  if (!body.query || typeof body.query !== "string") {
    sendError(res, 400, "invalid_query", "query는 비어 있지 않은 문자열이어야 합니다")
    // [자바 노트] return 을 빼먹으면 아래 코드가 계속 실행되어 응답을 두 번 보내려 한다.
    //            스프링처럼 "리턴하면 끝"이 아니라 직접 흐름을 끊어야 한다.
    return
  }
  if (body.nResults !== undefined) {
    if (typeof body.nResults !== "number" || body.nResults < 1 || body.nResults > 50) {
      sendError(res, 400, "invalid_n_results", "nResults는 1과 50 사이의 숫자여야 합니다")
      return
    }
  }

  try {
    const results = await searchDocuments(
      RAG_COLLECTION,
      body.query,
      body.nResults ?? 5,
      body.where,
    )
    // [자바 노트] res.json(...) ≒ return ResponseEntity.ok(...)
    res.json({ results, query: body.query })
  } catch (error) {
    sendError(res, 502, "search_failed", "검색 처리 중 오류가 발생했습니다", errorMessage(error))
  }
})
