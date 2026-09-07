import { runExample } from "./lib/chroma.js"
import { checkQuestion } from "./lib/guardrails.js"
import { answerQuestion } from "./lib/rag.js"
import { describeRoute, heuristicRoute, planRoute } from "./lib/router.js"

/**
 * 질의 라우팅 데모 - `npm run route`
 *
 * 질문마다 규칙 기반과 LLM 기반이 각각 어디로 보내는지 나란히 찍는다.
 * 둘이 갈리는 지점을 보는 것이 이 데모의 목적이다.
 * 규칙은 표현이 조금만 달라져도 놓치고, LLM 은 놓치지 않는 대신 호출 비용이 든다.
 *
 * vector 로 간 질문만 실제로 답변까지 만든다. graph 는 Neo4j 적재가 필요하고
 * (`npm run graph:seed`), none 은 애초에 검색하지 않는 경로라서다.
 */
const QUESTIONS: readonly string[] = [
  "에티오피아 원두는 어떤 향이 나나요?",
  "에티오피아 원두와 케냐 원두 중 어느 쪽이 산미가 강한가요?", // 관계 어휘가 없는 비교 질문
  "커피 로스팅과 원두 향의 관계는 무엇인가요?",
  "안녕하세요",
]

await runExample("질의 라우팅 (에이전트의 최소 형태)", async () => {
  for (const question of QUESTIONS) {
    console.log(`\n질문: ${question}`)

    // 라우팅 전에 가드레일을 먼저 통과시킨다. 순서가 중요하다 -
    // 막을 입력에 LLM 호출을 한 번이라도 쓰면 그만큼 손해다.
    const verdict = checkQuestion(question)
    if (!verdict.ok) {
      console.log(`  차단: ${verdict.message}`)
      continue
    }

    const rule = heuristicRoute(question)
    const llm = await planRoute(question)
    console.log(`  규칙: ${describeRoute(rule)}`)
    console.log(`  LLM : ${describeRoute(llm)}${rule.route === llm.route ? "" : "  <- 갈렸다"}`)

    if (llm.route === "vector") {
      const { answer } = await answerQuestion(question, 3)
      console.log(`  답변: ${answer.replace(/\n/g, " ")}`)
    } else if (llm.route === "graph") {
      console.log("  -> GraphRAG 경로입니다. npm run graph:search 로 확인하세요")
    } else {
      console.log("  -> 검색을 건너뜁니다")
    }
  }
})
