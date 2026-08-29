import type { Collection } from "chromadb"

/**
 * 벡터 검색과 키워드 검색을 합친다. (강의 19)
 *
 * 벡터 검색은 의미는 잘 잡지만 고유명사를 놓칠 때가 있고,
 * 키워드 검색은 정확히 일치해야만 잡힌다. 둘을 더해서 약점을 메운다.
 */
export interface HybridHit {
  id: string
  score: number
}

export async function hybridSearch(
  collection: Collection,
  query: string,
  keyword: string,
  nResults = 5,
  keywordBoost = 0.5,
): Promise<HybridHit[]> {
  // [초보자 설명] 왜 nResults 의 2배를 뽑을까?
  // 최종적으로 5개가 필요해도, 벡터에서 5개만 뽑으면 키워드 가산점으로 순위가 뒤집힐
  // 여지가 없다. 후보를 넉넉히 뽑아둬야 "벡터로는 7등이지만 키워드가 있어서 3등"
  // 같은 역전이 일어날 수 있다. 이렇게 넓게 뽑고 좁히는 것이 검색의 기본 패턴이다.
  const vector = await collection.query({
    queryTexts: [query],
    nResults: nResults * 2,
  })
  // $contains 는 문서 본문에 이 글자열이 그대로 들어있는지 보는 조건이다.
  // 의미가 아니라 글자를 보므로, 임베딩이 놓치는 고유명사·모델명·코드에 강하다.
  const keywordHit = await collection.get({
    whereDocument: { $contains: keyword },
  })

  // [자바 노트] Map<String, Double> 자리. id 별로 점수를 누적한다.
  const score = new Map<string, number>()

  // [초보자 설명] 거리(distance)와 유사도(similarity)는 방향이 반대다.
  // 거리는 "얼마나 먼가"라서 작을수록 좋고, 점수는 클수록 좋아야 정렬이 자연스럽다.
  // 그래서 1에서 빼서 뒤집는다. 거리 0.1 → 유사도 0.9, 거리 0.9 → 유사도 0.1.
  vector.ids[0]?.forEach((id, i) => {
    const similarity = 1 - (vector.distances?.[0]?.[i] ?? 1)
    score.set(id, (score.get(id) ?? 0) + similarity)
  })

  // 키워드가 들어있으면 고정 가산점(keywordBoost)을 더한다.
  // 이 값이 클수록 "글자가 일치하는 것"을 "의미가 비슷한 것"보다 중요하게 본다는 뜻이다.
  // 0.5 는 유사도 0.5 만큼의 가치를 준다는 의미이니, 검색 성격에 맞춰 조절하면 된다.
  keywordHit.ids.forEach((id) => {
    score.set(id, (score.get(id) ?? 0) + keywordBoost)
  })

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, nResults)
    .map(([id, s]) => ({ id, score: s }))
}

/**
 * Reciprocal Rank Fusion (RRF). (강의 31)
 *
 * 여러 개의 순위 목록을 하나로 합친다. 점수 체계가 서로 다른 검색들을
 * 섞을 때, 점수 대신 "몇 등이었나"만 쓰므로 정규화가 필요 없다.
 *
 * [초보자 설명] 왜 점수를 안 쓰고 등수를 쓸까?
 * 벡터 검색의 점수는 0~1 근처의 "거리"이고, 크로스 인코더의 점수는 -10~+10 같은
 * 범위 제한 없는 값이다. 이 둘을 그냥 더하면 숫자가 큰 쪽이 항상 이겨버린다.
 * 반면 "1등, 2등, 3등"은 어떤 검색기든 의미가 같다. 그래서 등수만 가지고 합친다.
 *
 * 계산식은 각 목록에서 `1 / (k + 등수)` 를 더하는 것이다.
 *   1등 → 1/61,  2등 → 1/62,  3등 → 1/63 ...  (k=60 일 때)
 * 두 검색 모두에서 상위권이면 두 번 더해지므로 자연스럽게 위로 올라간다.
 *
 * k 는 왜 60인가? 등수 사이의 점수 차를 완만하게 만드는 완충값이다.
 * k 가 0 이면 1등(1/1)과 2등(1/2)의 차이가 너무 커서 한 검색기의 1등이 모든 걸 결정한다.
 * k 를 크게 두면 1/61 과 1/62 처럼 차이가 작아져서, "여러 목록에서 고르게 상위권인 문서"가
 * "한 목록에서만 1등인 문서"를 이길 수 있다. 60은 원 논문에서 쓴 관행적인 값이다.
 *
 * [자바 노트] forEach 의 두 번째 인자(rank)는 인덱스다. 0부터 시작하므로
 *            사람이 세는 등수로 바꾸려고 +1 을 한다.
 */
export function rrfMerge(rankings: string[][], k = 60): string[] {
  const score = new Map<string, number>()
  for (const ranking of rankings) {
    ranking.forEach((id, rank) => {
      score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1))
    })
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
