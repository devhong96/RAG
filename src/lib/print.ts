/** 검색 결과를 사람이 읽기 좋게 출력한다. (강의 13~) */
export function printSearchResult(result: {
  documents?: (string | null)[][] | null
  distances?: number[][] | null
  ids: string[][]
}): void {
  const documents = result.documents?.[0] ?? []
  const distances = result.distances?.[0] ?? []
  const ids = result.ids[0] ?? []

  ids.forEach((id, i) => {
    console.log(`[${i + 1}] id=${id} distance=${distances[i]?.toFixed(3)}`)
    console.log(`    ${documents[i]}`)
  })
}

/** 코사인 거리. 벡터를 직접 비교할 때 쓴다. (강의 16, 27) */
export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 1
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb))
}
