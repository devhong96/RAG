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

/**
 * 상위 k개 안에 정답이 들어있는 비율. (Recall@k / Top-K 정확도)
 *
 * [초보자 설명] 가장 단순한 검색 품질 지표다.
 * 질문 10개를 던져서 7개에서 정답 문서가 상위 k개 안에 있었다면 0.7 이다.
 * k 를 크게 잡으면 당연히 점수가 올라가므로(k=전체면 항상 1.0),
 * Top-1 과 Top-3 처럼 여러 k 를 함께 보는 게 의미 있다.
 * 단점: "몇 등이었는지"는 보지 않는다. 1등이든 k등이든 똑같이 1점이다.
 */
export async function evaluateTopK(
  collection: Collection,
  cases: readonly EvalCase[],
  k: number,
): Promise<number> {
  // 0으로 나누면 JavaScript는 예외 대신 NaN을 만든다. NaN은 JSON 직렬화나 평균 집계에서
  // 원인을 찾기 어려운 값이 되므로, "평가할 사례 없음"을 이 예제에서는 0으로 정의한다.
  if (cases.length === 0) return 0
  let hits = 0
  for (const { query, expectedId } of cases) {
    const result = await collection.query({ queryTexts: [query], nResults: k })
    if ((result.ids[0] ?? []).includes(expectedId)) hits += 1
  }
  return hits / cases.length
}

/**
 * MRR (Mean Reciprocal Rank, 평균 역순위).
 * 정답이 1등이면 1, 2등이면 0.5, 3등이면 0.33...
 * Top-K 와 달리 "얼마나 위에 올렸는가"까지 본다.
 *
 * [초보자 설명] 이름을 뜯어보면 계산법이 그대로 보인다.
 *   Reciprocal(역수) = 1/등수,  Rank(순위),  Mean(평균)
 * 즉 질문마다 "1 / 정답의 등수"를 구해서 전부 평균 낸 값이다.
 *   질문A 정답이 1등 → 1/1 = 1.0
 *   질문B 정답이 4등 → 1/4 = 0.25
 *   질문C 정답 못 찾음 → 0
 *   MRR = (1.0 + 0.25 + 0) / 3 = 0.417
 *
 * 왜 역수를 쓸까? 1등과 2등의 차이(1 → 0.5)는 크게, 9등과 10등의 차이(0.111 → 0.1)는
 * 작게 반영하기 위해서다. 사용자는 상위 몇 개만 보므로 위쪽 순위 변화가 훨씬 중요하다.
 *
 * 재랭킹처럼 "찾긴 찾았는데 순위를 못 올린" 문제를 개선했는지 볼 때 Recall 보다 민감하다.
 * (Recall 은 그대로인데 MRR 만 오르면 = 같은 문서를 더 위로 올렸다는 뜻)
 */
export async function evaluateMRR(
  collection: Collection,
  cases: readonly EvalCase[],
  nResults = 10,
): Promise<number> {
  // evaluateTopK와 같은 빈 입력 정책을 유지한다. 지표마다 처리 방식이 다르면 비교표가 깨진다.
  if (cases.length === 0) return 0
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
  // search를 호출하기 전에 반환하므로 빈 평가셋 테스트는 외부 DB 없이도 실행할 수 있다.
  if (cases.length === 0) return { recall: 0, mrr: 0 }
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

/**
 * 지연 시간까지 함께 잰다. 후보 수(N)를 늘렸을 때의 비용을 볼 때 쓴다.
 *
 * [초보자 설명] 왜 평균이 아니라 p95 를 볼까?
 * p95(95 백분위수)는 "100번 중 95번은 이 시간 안에 끝난다"는 뜻이다.
 * 평균은 가끔 튀는 느린 요청을 다른 빠른 요청들이 가려버린다.
 * 평균 50ms 라도 20번에 1번은 2초가 걸린다면 사용자는 "느리다"고 느낀다.
 * 그래서 서비스 품질은 보통 평균이 아니라 p95/p99 로 관리한다.
 *
 * 구하는 법: 걸린 시간들을 오름차순으로 정렬한 뒤 95% 지점의 값을 꺼낸다.
 * 주의 — 표본이 적으면 p95 는 사실상 "최댓값"이 된다.
 * 예를 들어 질문이 4개뿐이면 95% 지점이 곧 4번째(가장 느린) 값이다.
 * 이 저장소의 평가셋은 4개짜리라 p95 를 참고 수치 정도로만 봐야 한다.
 */
export async function measureLatency(
  cases: readonly EvalCase[],
  search: (query: string) => Promise<string[]>,
): Promise<{ recall: number; p95: number }> {
  const times: number[] = []
  let hits = 0
  for (const { query, expectedId } of cases) {
    // [자바 노트] performance.now() 는 System.nanoTime() 자리다.
    //            Date.now() 와 달리 시스템 시계 변경에 영향받지 않아 구간 측정에 적합하다.
    const t0 = performance.now()
    const ids = await search(query)
    times.push(performance.now() - t0)
    if (ids.includes(expectedId)) hits += 1
  }
  if (times.length === 0) return { recall: 0, p95: 0 }

  times.sort((a, b) => a - b)
  // 백분위수의 표준적인 계산(nearest-rank)은 ceil(n × 0.95) 번째 값이다.
  // 배열 인덱스는 0부터 시작하므로 1을 뺀다.
  // (예전 코드는 floor(n × 0.95) 를 썼는데, n=20 이면 인덱스 19 = 최댓값이 잡혀
  //  p95 라는 이름과 달리 사실상 p100 을 보고했다.)
  const index = Math.max(0, Math.ceil(times.length * 0.95) - 1)
  const p95 = times[index] ?? 0
  return { recall: hits / cases.length, p95 }
}
