// [자바 노트] express = 스프링 부트 자리. 다만 훨씬 얇다.
//            DI 컨테이너도, 컴포넌트 스캔도, 어노테이션도 없다.
//            필요한 것을 import 해서 직접 조립한다.
import express, { type ErrorRequestHandler } from "express"
import { config } from "../config.js"
import { askRouter } from "./routes/ask.js"
import { documentsRouter } from "./routes/documents.js"
import { errorMessage, sendError } from "./routes/errors.js"
import { healthRouter } from "./routes/health.js"
import { searchRouter } from "./routes/search.js"

/**
 * AI 검색 / RAG 백엔드. (강의 22~24) — `npm run server`
 *
 * [자바 노트] 스프링 대응표
 *   express()                   → SpringApplication.run()
 *   Router()                    → @RestController
 *   app.use(라우터)              → 컴포넌트 스캔으로 등록되던 것을 손으로 등록
 *   app.use(express.json())     → 잭슨 자동 설정 (본문 JSON 파싱)
 *   app.use(errorHandler)       → @ControllerAdvice
 *
 * 등록 "순서"가 중요하다. 위에서부터 차례로 거쳐가는 필터 체인이라고 보면 된다.
 * 에러 핸들러는 반드시 맨 마지막에 등록해야 앞의 라우터에서 난 에러를 받는다.
 */
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // [초보자 설명] HTTP 상태 코드에서 4xx 는 "요청을 보낸 쪽 잘못", 5xx 는 "서버 잘못"이다.
  // 본문이 깨진 JSON(예: '{oops')이면 express.json() 이 파싱하다 SyntaxError 를 던지는데,
  // 이걸 그냥 흘려보내면 아래 500 으로 응답된다. 서버는 멀쩡한데 서버 탓이 되는 셈이다.
  // 클라이언트가 원인을 알 수 있도록 400 으로 바꿔서 돌려준다.
  // (type === "entity.parse.failed" 는 express 가 본문 파싱 실패에 붙여주는 표시다.
  //  이걸 확인하지 않으면 우리 코드의 다른 SyntaxError 까지 400 으로 잘못 분류된다.)
  if (error instanceof SyntaxError && (error as { type?: string }).type === "entity.parse.failed") {
    sendError(res, 400, "invalid_json", "요청 본문이 올바른 JSON 이 아닙니다", errorMessage(error))
    return
  }
  console.error("처리되지 않은 에러:", error)
  sendError(res, 500, "internal_error", "서버 내부 오류가 발생했습니다", errorMessage(error))
}

const app = express()

// 본문을 JSON 으로 파싱해서 req.body 에 넣어준다. 이게 없으면 req.body 가 undefined 다.
app.use(express.json())

app.use(healthRouter)
app.use(searchRouter)
app.use(documentsRouter)
app.use(askRouter)
app.use(errorHandler) // ← 반드시 마지막

// [자바 노트] 톰캣이 따로 없다. Node 프로세스가 곧 서버다.
//            listen() 이 이벤트 루프를 붙잡고 있어서 프로세스가 종료되지 않는다.
app.listen(config.server.port, () => {
  console.log(`서버 시작: http://localhost:${config.server.port}`)
  console.log(`  GET  /health`)
  console.log(`  POST /search     { query, nResults?, where? }`)
  console.log(`  POST /documents  { source, text, metadata? }`)
  console.log(`  POST /ask        { question, nResults? }`)
})
