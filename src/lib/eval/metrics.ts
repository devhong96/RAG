import type { Collection } from "chromadb"

/**
 * 검색 품질 측정. (강의 19, 30)
 *
 * "좋아진 것 같다"는 느낌이 아니라 숫자로 확인해야
 * 청킹 전략이나 모델을 바꿨을 때 실제로 나아졌는지 알 수 있다.
 */
export interface EvalCase {
  query: string
  expectedId: string
}

/** 상위 k개 안에 정답이 들어있는 비율. */
export async function evaluateTopK(
  collection: Collection,
  cases: readonly EvalCase[],
  k: number,
): Promise<number> {
  let hits = 0
  for (const { query, expectedId } of cases) {
    const result = await collection.query({ queryTexts: [query], nResults: k })
    if ((result.ids[0] ?? []).includes(expectedId)) hits += 1
  }
  return hits / cases.length
}

/**
 * MRR (Mean Reciprocal Rank).
 * 정답이 1등이면 1, 2등이면 0.5, 3등이면 0.33...
 * Top-K 와 달리 "얼마나 위에 올렸는가"까지 본다.
 */
export async function evaluateMRR(
  collection: Collection,
  cases: readonly EvalCase[],
  nResults = 10,
): Promise<number> {
  let total = 0
  for (const { query, expectedId } of cases) {
    const result = await collection.query({ queryTexts: [query], nResults })
    const rank = (result.ids[0] ?? []).indexOf(expectedId)
    if (rank >= 0) total += 1 / (rank + 1)
  }
  return total / cases.length
}

/** 임의의 검색 함수에 대해 Recall 과 MRR 을 함께 낸다. 재랭킹 비교용. */
export async function evaluateRetrieval(
  cases: readonly EvalCase[],
  search: (query: string) => Promise<string[]>,
): Promise<{ recall: number; mrr: number }> {
  let hits = 0
  let mrr = 0
  for (const { query, expectedId } of cases) {
    const ids = await search(query)
    if (ids.includes(expectedId)) hits += 1
    const rank = ids.indexOf(expectedId)
    if (rank >= 0) mrr += 1 / (rank + 1)
  }
  return { recall: hits / cases.length, mrr: mrr / cases.length }
}

/** 지연 시간까지 함께 잰다. 후보 수(N)를 늘렸을 때의 비용을 볼 때 쓴다. */
export async function measureLatency(
  cases: readonly EvalCase[],
  search: (query: string) => Promise<string[]>,
): Promise<{ recall: number; p95: number }> {
  const times: number[] = []
  let hits = 0
  for (const { query, expectedId } of cases) {
    const t0 = performance.now()
    const ids = await search(query)
    times.push(performance.now() - t0)
    if (ids.includes(expectedId)) hits += 1
  }
  times.sort((a, b) => a - b)
  const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1] ?? 0
  return { recall: hits / cases.length, p95 }
}
