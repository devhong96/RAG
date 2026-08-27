import { resetCollection, runExample } from "../lib/chroma.js"
import { Neo4jKnowledgeGraph } from "./client.js"

/**
 * [Graph DB 스크립트 1: 데이터 적재 (Seed)]
 *
 * 1. Neo4j 그래프 DB에 개체(노드)와 관계(엣지)를 등록합니다.
 * 2. Chroma 벡터 DB에 개별 텍스트 청크를 적재합니다.
 */

export const CHUNKS = [
  {
    id: "chunk-1",
    text: "에티오피아 게이샤 품종은 파나마의 에스메랄다 농장에서 경매를 통해 세계 최고가로 알려졌다.",
  },
  {
    id: "chunk-2",
    text: "에스메랄다 농장은 파나마 바루 화산 자락의 보케테 고지대에 위치한 명문 스페셜티 농장이다.",
  },
  {
    id: "chunk-3",
    text: "보케테 고지대는 화산재 토양과 짙은 안개(바하레케 현상)로 체리의 당도가 극대화된다.",
  },
  {
    id: "chunk-4",
    text: "바하레케(Bajareque)는 태평양과 카리브해의 기류가 만나 발생하는 미세한 안개비 기후 현상이다.",
  },
  {
    id: "chunk-5",
    text: "콜롬비아 수프레모는 고소한 너트향과 마일드한 산미로 블렌딩의 기본 베이스로 애용된다.",
  },
]

export const RELATIONS = [
  { source: "게이샤", relation: "대표 농장", target: "에스메랄다 농장" },
  { source: "에스메랄다 농장", relation: "위치", target: "보케테 고지대" },
  { source: "보케테 고지대", relation: "토양 특성", target: "화산재 토양" },
  { source: "보케테 고지대", relation: "기후 현상", target: "바하레케 현상" },
  { source: "바하레케 현상", relation: "특징", target: "미세한 안개비 기후" },
]

await runExample("Graph DB 데이터 적재 (Seed)", async () => {
  const graph = new Neo4jKnowledgeGraph()

  const isConnected = await graph.verifyConnectivity()
  if (!isConnected) {
    console.error("❌ Neo4j 연결 실패: Docker 컨테이너(neo4j-rag)를 먼저 띄워주세요.")
    return
  }

  try {
    console.log("\n[1] Neo4j 기존 데이터 초기화 중...")
    await graph.clear()

    console.log("[2] Neo4j 노드 및 관계(Edge) 적재 중...")
    for (const r of RELATIONS) {
      await graph.addRelation(r.source, r.relation, r.target)
      console.log(`  🔗 [${r.source}] --(${r.relation})--> [${r.target}]`)
    }
    console.log(`✅ Neo4j에 ${RELATIONS.length}개 관계 저장 완료`)

    console.log("\n[3] Chroma 벡터 DB에 청크 적재 중...")
    const collection = await resetCollection("neo4j-graph-rag-demo")
    await collection.upsert({
      ids: CHUNKS.map((c) => c.id),
      documents: CHUNKS.map((c) => c.text),
    })
    console.log(`✅ Chroma에 ${CHUNKS.length}개 문서 청크 적재 완료`)

    console.log("\n🎉 모든 데이터 적재 완료! 다음 스크립트를 실행해 검색해 보세요:")
    console.log("   👉 npm run graph:search")
    console.log("   👉 npm run graph:status")
  } finally {
    await graph.close()
  }
})
