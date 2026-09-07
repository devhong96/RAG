import { createInterface } from "node:readline/promises"
import { answerInConversation, conversations, RAG_COLLECTION } from "./lib/rag.js"

/**
 * 멀티턴 대화 RAG 데모. — `npm run chat`
 *
 * 앞선 질문을 기억하므로 "그거 왜 필요한데요?" 처럼 이어서 물을 수 있다.
 * 먼저 `rag-docs` 컬렉션에 자료가 들어 있어야 한다. (`npm run lec:23-24` 로 채울 수 있다)
 *
 *   /new    대화 기록을 비운다 (화제 전환)
 *   /exit   종료
 *
 * [자바 노트] readline/promises 는 Scanner 자리다. question() 이 Promise 를 돌려주므로
 *            await 로 한 줄씩 받아 while 루프를 돌린다.
 */
const SESSION_ID = "cli"

const rl = createInterface({ input: process.stdin, output: process.stdout })

console.log(`\n=== 대화형 RAG (컬렉션: ${RAG_COLLECTION}) ===`)
console.log("이어서 질문할 수 있습니다. /new 로 새 대화, /exit 로 종료.\n")

try {
  while (true) {
    const input = (await rl.question("나> ")).trim()
    if (!input) continue
    if (input === "/exit") break
    if (input === "/new") {
      conversations.clear(SESSION_ID)
      console.log("(대화 기록을 비웠습니다)\n")
      continue
    }

    try {
      const result = await answerInConversation(SESSION_ID, input)
      // 지시어가 무엇으로 풀렸는지 보여준다. 이 줄이 이 데모의 핵심 관찰 포인트다.
      if (result.searchQuery !== input) {
        console.log(`  (검색 질의로 다시 씀: "${result.searchQuery}")`)
      }
      console.log(`AI> ${result.answer}`)
      const sources = [...new Set(result.sources.map((s) => s.metadata?.source ?? "unknown"))]
      console.log(`    출처: ${sources.join(", ") || "없음"}\n`)
    } catch (error) {
      // 한 번의 실패로 대화 전체를 끝내지 않는다. 모델이 느려 시간 초과가 나도 다시 물으면 된다.
      console.error(`[실패] ${error instanceof Error ? error.message : String(error)}\n`)
    }
  }
} finally {
  rl.close()
}
