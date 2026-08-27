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
  const vector = await collection.query({
    queryTexts: [query],
    nResults: nResults * 2,
  })
  const keywordHit = await collection.get({
    whereDocument: { $contains: keyword },
  })

  const score = new Map<string, number>()

  // 거리를 유사도로 뒤집어서 더한다 (거리가 작을수록 높은 점수)
  vector.ids[0]?.forEach((id, i) => {
    const similarity = 1 - (vector.distances?.[0]?.[i] ?? 1)
    score.set(id, (score.get(id) ?? 0) + similarity)
  })

  // 키워드가 들어있으면 고정 가산점
  keywordHit.ids.forEach((id) => {
    score.set(id, (score.get(id) ?? 0) + keywordBoost)
  })

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, nResults)
    .map(([id, s]) => ({ id, score: s }))
}

/**
 * Reciprocal Rank Fusion. (강의 31)
 *
 * 여러 개의 순위 목록을 하나로 합친다. 점수 체계가 서로 다른 검색들을
 * 섞을 때, 점수 대신 "몇 등이었나"만 쓰므로 정규화가 필요 없다.
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
