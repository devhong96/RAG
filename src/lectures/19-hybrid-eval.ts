import { resetCollection, runExample } from "../lib/chroma.js"
import { hybridSearch } from "../lib/search/hybrid.js"
import {
  evaluateMRR,
  evaluateRetrieval,
  evaluateTopK,
  measureLatency,
  type EvalCase,
} from "../lib/eval/metrics.js"

/** 하이브리드 검색과 정량 평가. (강의 19) */
const ARTICLES = [
  { id: "a-1", text: "원두를 직접 갈아 마시는 커피의 매력", category: "coffee" },
  { id: "a-2", text: "캡슐 머신으로 빠르게 즐기는 에스프레소", category: "coffee" },
  { id: "a-3", text: "전기 자동차의 충전 효율 비교", category: "ev" },
  { id: "a-4", text: "도심 자전거 출퇴근 경험담", category: "bike" },
]

// [자바 노트] readonly EvalCase[] 는 List<EvalCase> 를 불변으로 만든 것과 같다.
//            (List.of(...) 로 만든 것처럼 요소를 못 바꾼다)
const EVAL_SET: readonly EvalCase[] = [
  { query: "커피 원두 종류", expectedId: "a-1" },
  { query: "에스프레소 캡슐", expectedId: "a-2" },
  { query: "전기차 충전 효율", expectedId: "a-3" },
  { query: "도심 자전거 통근", expectedId: "a-4" },
]

const KEYWORDS: Record<string, string> = {
  // $contains는 질의에서 키워드를 자동 추출하지 않는다. 비교 실습을 위해 정답과 무관하게
  // 각 질의에서 실제 문서에 등장하는 핵심 문자열 하나를 미리 지정한다.
  "커피 원두 종류": "원두",
  "에스프레소 캡슐": "에스프레소",
  "전기차 충전 효율": "충전",
  "도심 자전거 통근": "자전거",
}

await runExample("[19강] 하이브리드 검색 + Top-K/MRR 평가", async () => {
  const collection = await resetCollection("hybrid-eval")
  // [자바 노트] .map() 은 자바 스트림의 map 과 같다.
  //            다만 TS 배열은 stream()/collect() 없이 바로 체이닝된다.
  await collection.upsert({
    ids: ARTICLES.map((a) => a.id),
    documents: ARTICLES.map((a) => a.text),
    metadatas: ARTICLES.map((a) => ({ category: a.category })),
  })

  console.log("--- 순수 벡터 검색 ---")
  console.log(`Top-1 정확도: ${((await evaluateTopK(collection, EVAL_SET, 1)) * 100).toFixed(0)}%`)
  console.log(`Top-3 정확도: ${((await evaluateTopK(collection, EVAL_SET, 3)) * 100).toFixed(0)}%`)
  console.log(`MRR         : ${(await evaluateMRR(collection, EVAL_SET)).toFixed(3)}`)

  console.log("\n--- 하이브리드 (벡터 + 키워드) ---")
  const ranked = await hybridSearch(collection, "원두의 특징", "에스프레소", 3)
  ranked.forEach((h, i) => console.log(`${i + 1}위 ${h.id} score=${h.score.toFixed(3)}`))

  // 같은 평가셋과 같은 Top-K로 검색 전략을 비교해야 개선 여부를 숫자로 판단할 수 있다.
  // 서로 다른 문제를 풀게 하면 점수 차이가 알고리즘 때문인지 문제 난이도 때문인지 알 수 없다.
  const strategies = [
    {
      name: "벡터",
      search: async (query: string) => {
        const result = await collection.query({ queryTexts: [query], nResults: 3 })
        return result.ids[0] ?? []
      },
    },
    {
      // 이 예제는 BM25가 아니라 정확한 문자열 포함 여부에 가산점을 주는 방식이다.
      name: "벡터+문자열",
      search: async (query: string) =>
        (await hybridSearch(collection, query, KEYWORDS[query] ?? query, 3)).map((hit) => hit.id),
    },
  ]

  const comparison = []
  for (const strategy of strategies) {
    // 품질과 지연 시간을 분리해 재는 이유: 정확도가 올라도 너무 느려지면 서비스에는 쓸 수 없다.
    // 작은 평가셋의 p95는 사실상 최댓값에 가까우므로 절대 성능보다 전략 간 경향만 본다.
    const quality = await evaluateRetrieval(EVAL_SET, strategy.search)
    const latency = await measureLatency(EVAL_SET, strategy.search)
    comparison.push({
      방식: strategy.name,
      "Recall@3": quality.recall.toFixed(3),
      MRR: quality.mrr.toFixed(3),
      "p95(ms)": latency.p95.toFixed(1),
    })
  }
  console.log("\n--- 동일 평가셋 비교 ---")
  console.table(comparison)

  console.log("\nMRR 은 정답을 얼마나 위에 올렸는지까지 본다. 1등이면 1, 2등이면 0.5.")
})
