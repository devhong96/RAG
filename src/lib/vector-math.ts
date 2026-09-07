/**
 * 벡터 쿼리 언어의 가장 작은 실행 단위.
 *
 * 벡터 DB 제품마다 연산자 이름은 다르지만 결국 아래 연산으로 귀결된다.
 * DB 없이도 수학 자체를 검증할 수 있도록 순수 함수로 분리했다.
 */

function assertComparable(a: readonly number[], b: readonly number[]): void {
  if (a.length === 0 || b.length === 0) throw new Error("벡터는 비어 있을 수 없습니다")
  if (a.length !== b.length) {
    throw new Error(`벡터 차원이 다릅니다: ${a.length} != ${b.length}`)
  }
}

export function dotProduct(a: readonly number[], b: readonly number[]): number {
  assertComparable(a, b)
  return a.reduce((sum, value, i) => sum + value * (b[i] as number), 0)
}

export function l2Distance(a: readonly number[], b: readonly number[]): number {
  assertComparable(a, b)
  return Math.sqrt(a.reduce((sum, value, i) => sum + (value - (b[i] as number)) ** 2, 0))
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  assertComparable(a, b)
  const magnitudeA = Math.sqrt(dotProduct(a, a))
  const magnitudeB = Math.sqrt(dotProduct(b, b))
  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct(a, b) / (magnitudeA * magnitudeB)
}

export function cosineDistance(a: readonly number[], b: readonly number[]): number {
  return 1 - cosineSimilarity(a, b)
}

/** 여러 벡터의 중심점. 문서 묶음이나 사용자 장기 기억의 대표 벡터를 만들 때 쓴다. */
export function centroid(vectors: readonly (readonly number[])[]): number[] {
  if (vectors.length === 0) throw new Error("중심점을 계산할 벡터가 없습니다")
  const dimension = vectors[0]?.length ?? 0
  if (dimension === 0) throw new Error("벡터는 비어 있을 수 없습니다")
  for (const vector of vectors) {
    if (vector.length !== dimension) throw new Error("모든 벡터의 차원이 같아야 합니다")
  }

  return Array.from({ length: dimension }, (_, i) =>
    vectors.reduce((sum, vector) => sum + (vector[i] as number), 0) / vectors.length,
  )
}

export interface RankedVector<T> {
  item: T
  similarity: number
  distance: number
}

/** Flat 검색: 모든 벡터를 정확히 비교한다. ANN 품질 평가의 정답지로도 쓸 수 있다. */
export function topKByCosine<T>(
  query: readonly number[],
  candidates: readonly { item: T; vector: readonly number[] }[],
  k: number,
): RankedVector<T>[] {
  if (!Number.isInteger(k) || k < 1) throw new Error("k는 1 이상의 정수여야 합니다")
  return candidates
    .map(({ item, vector }) => {
      const similarity = cosineSimilarity(query, vector)
      return { item, similarity, distance: 1 - similarity }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}
