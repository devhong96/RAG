import { openCollection, runExample } from "../lib/chroma.js"
import { Neo4jKnowledgeGraph } from "./client.js"

/**
 * [Graph DB 스크립트 3: 현재 그래프 상태 및 통계 확인 (Status)]
 *
 * 1. Neo4j에 현재 저장된 노드, 관계, 엔티티 목록을 조회합니다.
 * 2. Chroma 벡터 DB의 청크 개수를 확인합니다.
 * 3. Neo4j Browser 웹 시각화 접속 정보를 안내합니다.
 */

await runExample("Graph DB 현황 및 통계 확인 (Status)", async () => {
  const graph = new Neo4jKnowledgeGraph()

  const isConnected = await graph.verifyConnectivity()
  if (!isConnected) {
    console.error("❌ Neo4j 연결 실패: Docker 컨테이너(neo4j-rag)를 먼저 띄워주세요.")
    return
  }

  try {
    const stats = await graph.getStatistics()

    console.log("\n==================================================")
    console.log("【 Neo4j 그래프 데이터베이스 현황 】")
    console.log("==================================================")
    console.log(`📊 등록된 엔티티(노드) 수: ${stats.nodeCount}개`)
    console.log(`🔗 등록된 관계(엣지) 수:   ${stats.relationCount}개`)

    console.log("\n[엔티티 목록]")
    console.log(stats.entities.map((e) => ` • ${e}`).join("\n"))

    console.log("\n[관계망 목록]")
    stats.relations.forEach((r) => {
      console.log(` • [${r.source}] --(${r.relation})--> [${r.target}]`)
    })

    // Chroma DB 확인
    try {
      const collection = await openCollection("neo4j-graph-rag-demo")
      const chromaCount = await collection.count()
      console.log(`\n📄 Chroma 벡터 DB 청크 수: ${chromaCount}개`)
    } catch {
      console.log("\n📄 Chroma 벡터 DB: 아직 생성되지 않음 (npm run graph:seed 실행 필요)")
    }

    console.log("\n--------------------------------------------------")
    console.log("💡 [웹 브라우저에서 그래프 시각화 보기]")
    console.log("--------------------------------------------------")
    console.log("  1. 브라우저로 접속: http://localhost:7474")
    console.log("  2. 로그인 계정: neo4j / password123!")
    console.log("  3. Cypher 콘솔에 아래 쿼리를 입력하고 실행(▶)하세요:")
    console.log("     MATCH (n) RETURN n")
  } finally {
    await graph.close()
  }
})
