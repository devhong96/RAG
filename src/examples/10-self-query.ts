import { resetCollection, runExample } from "../lib/chroma.js"
import { selfQuerySearch, type MetadataField } from "../lib/search/self-query.js"
import { rewriteQuery, hydeSearch, expandQueries } from "../lib/search/rewrite.js"

/** 질의 재작성 · HyDE · Self-Querying. (강의 31~32) */
const ARTICLES = [
  { id: "m-1", text: "에티오피아 원두 산미와 향 가이드", category: "coffee", year: 2023 },
  { id: "m-2", text: "콜롬비아 원두 무게감 비교", category: "coffee", year: 2024 },
  { id: "m-3", text: "전기차 충전 속도 2024 리뷰", category: "ev", year: 2024 },
  { id: "m-4", text: "도심 자전거 출퇴근 안전 가이드", category: "bike", year: 2025 },
  { id: "m-5", text: "에티오피아 게이샤 품종 특징", category: "coffee", year: 2025 },
  { id: "m-6", text: "캡슐 머신 에스프레소 리뷰", category: "coffee", year: 2022 },
  { id: "m-7", text: "전기차 보조금 정책 2025", category: "ev", year: 2025 },
]

const SCHEMA: Record<string, MetadataField> = {
  category: { type: "string", enum: ["coffee", "ev", "bike"] },
  year: { type: "number", description: "발행 연도" },
}

await runExample("10 질의 재작성과 Self-Query", async () => {
  const collection = await resetCollection("rag-with-meta")
  await collection.upsert({
    ids: ARTICLES.map((a) => a.id),
    documents: ARTICLES.map((a) => a.text),
    metadatas: ARTICLES.map((a) => ({ category: a.category, year: a.year })),
  })

  const raw = "음... 커피 원두 중에 좀 시큼한 거 뭐 있더라?"
  console.log("원본 질의  :", raw)
  console.log("재작성     :", await rewriteQuery(raw))

  console.log("\n--- Multi-Query 변형 ---")
  ;(await expandQueries("커피 산미가 강한 원두", 4)).forEach((q, i) =>
    console.log(`  ${i + 1}. ${q}`),
  )

  console.log("\n--- HyDE (가상 답변으로 검색) ---")
  const hyde = await hydeSearch(collection, "산미가 강한 원두는?", 2)
  console.log("  가상 답변:", hyde.hypothetical.slice(0, 70), "...")
  console.log("  검색 결과:", hyde.docs)

  console.log("\n--- Self-Query (질의에서 필터 추출) ---")
  const result = await selfQuerySearch(
    collection,
    "2024년 이후 커피 관련 글 알려줘",
    SCHEMA,
  )
  console.log("문서    :", result.documents?.[0])
  console.log("메타데이터:", result.metadatas?.[0])
})
