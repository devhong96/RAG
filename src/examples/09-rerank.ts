import { resetCollection, runExample } from "../lib/chroma.js"
import { searchWithRerank } from "../lib/search/rerank.js"
import { evaluateRetrieval, type EvalCase } from "../lib/eval/metrics.js"

/**
 * 2단계 검색: 벡터로 후보를 넓게 → 크로스 인코더로 재랭킹. (강의 29~30)
 * 첫 실행 시 재랭킹 모델을 내려받는다 (수백 MB).
 */
const ARTICLES = [
  { id: "a-1", text: "에티오피아 원두는 베리류와 꽃향이 두드러진다.", source: "coffee" },
  { id: "a-2", text: "콜롬비아 원두는 균형 잡힌 무게감과 견과류 향이 있다.", source: "coffee" },
  { id: "a-3", text: "전기차 충전 속도는 모델과 충전기 종류에 따라 크게 다르다.", source: "ev" },
  { id: "a-4", text: "도심 자전거 출퇴근은 비용과 건강 양쪽에서 이점이 있다.", source: "bike" },
  { id: "a-5", text: "에티오피아 게이샤 품종은 산미와 향이 매우 화려하다.", source: "coffee" },
  { id: "a-6", text: "캡슐 머신으로 빠르게 즐기는 에스프레소가 인기를 끈다.", source: "coffee" },
  { id: "a-7", text: "전기차 보조금은 매년 정책에 따라 변동된다.", source: "ev" },
  { id: "a-8", text: "자전거 도로 인프라 확충이 안전 사고를 줄인다.", source: "bike" },
]

const EVAL_SET: readonly EvalCase[] = [
  { query: "에티오피아 게이샤 향", expectedId: "a-5" },
  { query: "캡슐 머신으로 에스프레소", expectedId: "a-6" },
  { query: "전기차 충전 시간 비교", expectedId: "a-3" },
  { query: "자전거 도로 안전", expectedId: "a-8" },
]

await runExample("09 재랭킹", async () => {
  const collection = await resetCollection("rerank-articles")
  await collection.upsert({
    ids: ARTICLES.map((a) => a.id),
    documents: ARTICLES.map((a) => a.text),
    metadatas: ARTICLES.map((a) => ({ source: a.source })),
  })

  const plain = await evaluateRetrieval(EVAL_SET, async (q) => {
    const r = await collection.query({ queryTexts: [q], nResults: 5 })
    return r.ids[0] ?? []
  })
  console.log(`순수 벡터  Recall@5=${(plain.recall * 100).toFixed(0)}% MRR=${plain.mrr.toFixed(3)}`)

  const reranked = await evaluateRetrieval(EVAL_SET, async (q) =>
    (await searchWithRerank(collection, q, 8, 5)).map((r) => r.id),
  )
  console.log(`재랭킹     Recall@5=${(reranked.recall * 100).toFixed(0)}% MRR=${reranked.mrr.toFixed(3)}`)
})
