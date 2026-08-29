/**
 * 검색 결과를 사람이 읽기 좋게 출력한다. (강의 13~)
 *
 * [초보자 설명] 매개변수 타입이 왜 이렇게 생겼을까?
 *
 * 1. 전부 2차원 배열(`[][]`)이다.
 *    collection.query() 는 질문을 여러 개 한꺼번에 받을 수 있게 만들어져 있다.
 *    그래서 결과가 "질문별 결과들의 배열"이 된다. 우리는 질문을 하나만 넣으므로
 *    항상 첫 번째([0])만 꺼내 쓴다.
 *
 * 2. 안쪽 원소에 `| null` 이 붙어 있다.
 *    Chroma 는 문서 본문이나 거리 값을 못 돌려주는 경우가 있어서(예: include 옵션에서
 *    빼고 조회한 경우) 자리만 있고 값이 null 일 수 있다.
 *    이 `| null` 을 빠뜨리면 실제 query() 결과를 이 함수에 넘길 때 타입 에러가 난다.
 *    (실제로 예전 시그니처가 distances 를 number[][] 로 적어둬서, 이 함수는
 *     어디에서도 쓸 수 없는 상태였다.)
 */
export function printSearchResult(result: {
  documents?: (string | null)[][] | null
  distances?: (number | null)[][] | null
  ids: string[][]
}): void {
  const documents = result.documents?.[0] ?? []
  const distances = result.distances?.[0] ?? []
  const ids = result.ids[0] ?? []

  ids.forEach((id, i) => {
    // [자바 노트] ?? 는 왼쪽이 null/undefined 일 때만 오른쪽을 쓴다.
    //            값이 없을 때 "undefined" 대신 "-" 를 보여준다.
    const distance = distances[i]?.toFixed(3) ?? "-"
    console.log(`[${i + 1}] id=${id} distance=${distance}`)
    console.log(`    ${documents[i] ?? ""}`)
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
