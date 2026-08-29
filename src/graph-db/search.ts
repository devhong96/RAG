import { openCollection, runExample } from "../lib/chroma.js"
import { Neo4jKnowledgeGraph } from "./client.js"
import { searchGraphRAG, answerFromGraphRAGHits } from "../lib/search/graph-rag.js"

/**
 * [Graph DB 스크립트 2: GraphRAG 질의 및 검색 (Search)]
 *
 * 1. Chroma 벡터 검색만 수행했을 때의 결과(한계점)를 관찰합니다.
 * 2. Neo4j 다단계 그래프 탐색 + 벡터 검색 + 크로스 인코더 재랭킹(GraphRAG) 결과를 확인합니다.
 * 3. 최종 LLM 답변을 생성합니다.
 */

await runExample("Graph DB 기반 GraphRAG 검색 및 질의응답", async () => {
  const graph = new Neo4jKnowledgeGraph()

  const isConnected = await graph.verifyConnectivity()
  if (!isConnected) {
    console.error("❌ Neo4j 연결 실패: Docker 컨테이너(neo4j-rag)를 먼저 띄워주세요.")
    return
  }

  try {
    const collection = await openCollection("neo4j-graph-rag-demo")
    const count = await collection.count()

    if (count === 0) {
      console.warn("⚠️ 적재된 데이터가 없습니다. 먼저 적재 스크립트를 실행해 주세요:")
      console.warn("   👉 npm run graph:seed")
      return
    }

    const query = process.argv[2] ?? "게이샤 품종의 에스메랄다 농장이 위치한 고지대의 독특한 기후 현상과 특징은?"

    console.log(`\n[사용자 질문]\n"${query}"\n`)

    // --- (A) 순수 벡터 검색 ---
    console.log("--------------------------------------------------")
    console.log("【 방식 A: 순수 벡터 검색 (Chroma Top 3) 】")
    console.log("--------------------------------------------------")
    const vectorOnly = await collection.query({
      queryTexts: [query],
      nResults: 3,
    })
    const vectorDocs = (vectorOnly.documents?.[0] ?? []) as string[]
    vectorDocs.forEach((doc: string, idx: number) => {
      console.log(`  [${idx + 1}위] ${doc}`)
    })
    console.log("  ⚠️  관찰: 질문에 '바하레케'라는 지명/명칭이 직접 없어 핵심 청크가 상위에서 누락될 위험 존재.")

    // --- (B) Neo4j GraphRAG + Cross-Encoder ---
    console.log("\n--------------------------------------------------")
    console.log("【 방식 B: Neo4j GraphRAG + 크로스 인코더 재랭킹 】")
    console.log("--------------------------------------------------")
    const hits = await searchGraphRAG(collection, graph, query, {
      vectorCandidates: 3,
      graphDepth: 2,
      topK: 4,
    })

    hits.forEach((hit, idx) => {
      const label = hit.sourceType === "graph" ? "[Neo4j 지식관계]" : "[Chroma 벡터문서]"
      console.log(`  [${idx + 1}위] ${label} (관련도: ${hit.score.toFixed(2)})`)
      console.log(`       ${hit.text}`)
    })

    // --- (C) 최종 LLM 답변 생성 ---
    console.log("\n--------------------------------------------------")
    console.log("【 LLM 최종 답변 생성 중... 】")
    console.log("--------------------------------------------------")
    // [초보자 설명] 위에서 이미 searchGraphRAG 로 hits 를 뽑아 화면에 출력했다.
    // 여기서 answerWithGraphRAG 를 부르면 똑같은 검색(벡터 + Neo4j + 리랭커)을 처음부터 다시 돌린다.
    // 결과는 같은데 가장 비싼 단계를 두 번 하는 셈이라, 뽑아둔 hits 를 그대로 재사용한다.
    const { answer } = await answerFromGraphRAGHits(query, hits)
    console.log(answer)
  } finally {
    await graph.close()
  }
})
