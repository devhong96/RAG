import { resetCollection, runExample } from "../lib/chroma.js"
import { hybridSearch } from "../lib/search/hybrid.js"
import { evaluateMRR, evaluateTopK, type EvalCase } from "../lib/eval/metrics.js"

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

await runExample("07 하이브리드 검색과 평가", async () => {
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

  console.log("\nMRR 은 정답을 얼마나 위에 올렸는지까지 본다. 1등이면 1, 2등이면 0.5.")
})
