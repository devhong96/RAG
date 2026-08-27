import { resetCollection, runExample } from "../lib/chroma.js"
import { KnowledgeGraph } from "../lib/graph/knowledge-graph.js"
import { searchGraphRAG, buildGraphRAGContext } from "../lib/search/graph-rag.js"

/**
 * 예제 11: 지식 그래프(Knowledge Graph) + 벡터 검색 + 크로스 인코더 재랭킹 (GraphRAG).
 *
 * [핵심 아이디어]
 * 1. 순수 벡터 검색은 개별 청크의 유사도만 보므로, 문서가 쪼개졌을 때
 *    다단계 관계(Multi-hop: A -> B -> C)를 연결하지 못하고 중요한 청크를 놓치기 쉽다.
 * 2. 그래프 DB(지식 그래프)는 엔티티와 관계를 통해 A와 C를 이어주는 다리 역할을 한다.
 * 3. 이렇게 모인 벡터 후보 + 그래프 관계 정보를 크로스 인코더(리랭커)에 태워
 *    질문과 진짜 관련 있는 알짜배기 지식만 최상단으로 재정렬한다.
 */

// 1. 쪼개져 있는 개별 문서 조각들 (청크)
const CHUNKS = [
  {
    id: "chunk-1",
    text: "에티오피아 게이샤 품종은 파나마의 에스메랄다 농장에서 경매를 통해 세계적으로 알려졌다.",
  },
  {
    id: "chunk-2",
    text: "에스메랄다 농장은 파나마 보케테 화산 고지대에 위치한 명문 스페셜티 커피 농장이다.",
  },
  {
    id: "chunk-3",
    text: "보케테 화산 고지대는 큰 일교차와 미네랄이 풍부한 화산재 토양을 지녀 체리의 당도 농축에 최적이다.",
  },
  {
    id: "chunk-4",
    text: "콜롬비아 수프레모는 고소한 견과류 풍미와 부드러운 산미로 대중적인 인기를 얻고 있다.",
  },
  {
    id: "chunk-5",
    text: "전기차 배터리는 급속 충전 시 발생하는 열을 효과적으로 제어하는 액체 냉각 기술이 핵심이다.",
  },
]

await runExample("인메모리 지식 그래프(Graph) + 벡터 + 리랭커 결합 (GraphRAG)", async () => {
  // 1. Chroma 벡터 컬렉션 세팅 및 문서 인제스트
  const collection = await resetCollection("graph-rag-demo")
  await collection.upsert({
    ids: CHUNKS.map((c) => c.id),
    documents: CHUNKS.map((c) => c.text),
  })

  // 2. 지식 그래프 구축 (엔티티 및 관계 연결)
  const graph = new KnowledgeGraph()

  // [게이샤] -(대표 농장)-> [에스메랄다 농장] -(위치)-> [보케테 화산 고지대] -(토양 특성)-> [화산재 토양]
  graph.addRelation("게이샤", "대표 농장", "에스메랄다 농장")
  graph.addRelation("에스메랄다 농장", "위치", "보케테 화산 고지대")
  graph.addRelation("보케테 화산 고지대", "토양 특성", "미네랄 화산재 토양")
  graph.addRelation("보케테 화산 고지대", "기후 특성", "큰 일교차와 높은 습도")

  // 다단계 추론이 필요한 복합 질문
  const query = "게이샤 품종으로 유명한 에스메랄다 농장이 있는 지역의 토양 및 기후 특징은?"

  console.log(`\n[사용자 질문]\n"${query}"\n`)

  // --- (A) 순수 벡터 검색만 수행했을 때 ---
  console.log("--------------------------------------------------")
  console.log("【 방식 A: 순수 벡터 검색 (Bi-Encoder Top 3) 】")
  console.log("--------------------------------------------------")
  const vectorOnly = await collection.query({
    queryTexts: [query],
    nResults: 3,
  })

  const vectorIds = vectorOnly.ids[0] ?? []
  const vectorDocs = vectorOnly.documents?.[0] ?? []
  vectorIds.forEach((id, idx) => {
    console.log(`[${idx + 1}위] (ID: ${id}) ${vectorDocs[idx]}`)
  })
  console.log("\n-> 관찰: 질문에 '보케테'라는 지명이 직접 언급되지 않았기 때문에,")
  console.log("   토양/기후 설명이 담긴 핵심 문서(chunk-3)의 순위가 낮거나 누락될 위험이 있음.\n")

  // --- (B) 그래프 DB + 벡터 검색 + 크로스 인코더 리랭커 적용 ---
  console.log("--------------------------------------------------")
  console.log("【 방식 B: 지식 그래프 + 벡터 검색 + 크로스 인코더 리랭킹 (GraphRAG) 】")
  console.log("--------------------------------------------------")

  // 1단계: 벡터 후보(3개) + 그래프 2-hop 관계 탐색
  // 2단계: 크로스 인코더로 정밀 관련도 재평가 후 Top 3 추출
  const graphRAGHits = await searchGraphRAG(collection, graph, query, {
    vectorCandidates: 3,
    graphDepth: 2,
    topK: 4,
  })

  graphRAGHits.forEach((hit, idx) => {
    const label = hit.sourceType === "graph" ? "[지식그래프]" : "[벡터문서]"
    console.log(`[${idx + 1}위] ${label} (점수: ${hit.score.toFixed(2)})`)
    console.log(`     내용: ${hit.text}`)
  })

  console.log("\n--------------------------------------------------")
  console.log("【 LLM에 전달되는 최종 조합 컨텍스트 (Prompt) 】")
  console.log("--------------------------------------------------")
  console.log(buildGraphRAGContext(graphRAGHits))

  console.log("\n-> 결과: 지식 그래프가 [게이샤] -> [보케테 화산 고지대] 관계를 연결해 주고,")
  console.log("   크로스 인코더가 질문의 의도(토양, 기후)에 가장 부합하는 지식을 상위로 올려주어")
  console.log("   단절된 정보가 하나로 완성된 최적의 컨텍스트를 구성함.")
})
