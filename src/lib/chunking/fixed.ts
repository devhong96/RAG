/**
 * 가장 단순한 청킹 전략들. (강의 15, 20)
 *
 * 글자 수로만 자르므로 문맥이 끊길 수 있다.
 * 한계를 체감해야 뒤의 recursive / semantic 청킹이 왜 필요한지 이해된다.
 */

/** 글자 수로 기계적으로 자른다. 가장 소박한 방법. */
export function fixedChunks(text: string, size = 300): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}

/**
 * 문장 경계(. ! ?)를 지키면서 chunkSize 를 넘지 않게 모은다.
 *
 * [초보자 설명] 왜 청크 크기를 지키는 게 중요한가?
 * RAG 는 청크 하나를 벡터(숫자 목록) 하나로 바꿔서 저장한다.
 * 청크가 길수록 그 안의 여러 주제가 벡터 하나에 뭉뚱그려져서, 검색할 때
 * "이 청크가 무엇에 대한 글인지"가 흐려진다. 그래서 적당히 잘게 잘라야 한다.
 *
 * 그런데 이 함수는 마침표(.!?)를 기준으로 문장을 나눈다. 문장부호가 아예 없는 글
 * (불릿 목록, 표, OCR 로 뽑은 텍스트, "~다"로 끝나고 마침표를 안 찍은 한국어 문장 등)은
 * 통째로 "문장 1개"로 잡혀서 chunkSize 를 아무리 작게 줘도 안 잘렸다.
 * 예: chunkText("가".repeat(500), 120) → 500자짜리 청크 1개 (120 을 무시)
 *
 * 이건 실제로 문제가 된다. 서버의 POST /documents 가 이 함수를 쓰기 때문에,
 * 사용자가 마침표 없는 문서를 올리면 문서 전체가 벡터 1개로 뭉개져 검색이 망가진다.
 * 그래서 아래 push() 에서 "문장 하나가 이미 chunkSize 보다 길면 글자 수로 강제로 자른다"는
 * 안전장치를 둔다. 문장 경계를 지키려는 원래 의도는 그대로 두고, 최후의 보루만 추가한 것.
 */
export function chunkText(text: string, chunkSize = 120): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ""

  // 완성된 청크를 결과 배열에 넣는 도우미 함수.
  // 문장 경계로는 더 이상 나눌 수 없는데도 chunkSize 를 넘는 경우에만 글자 수로 쪼갠다.
  // [자바 노트] 함수 안에 함수를 정의해서 바깥 변수(chunks)를 그대로 쓰고 있다.
  //            자바의 지역 클래스나 람다가 바깥 변수를 캡처하는 것과 같다.
  const push = (piece: string) => {
    const trimmed = piece.trim()
    if (!trimmed) return
    if (trimmed.length <= chunkSize) {
      chunks.push(trimmed)
      return
    }
    for (const part of fixedChunks(trimmed, chunkSize)) {
      const partTrimmed = part.trim()
      if (partTrimmed) chunks.push(partTrimmed)
    }
  }

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      push(current)
      current = sentence
    } else {
      current += (current ? " " : "") + sentence
    }
  }

  push(current)
  return chunks
}

/**
 * 겹치게 자른다. size=200, overlap=40 이면 다음 청크가 40자 앞에서 시작한다.
 * 장점: 청크 경계에서 잘려나가는 정보 손실이 줄어든다.
 * 단점: 데이터가 불필요하게 늘어난다.
 *
 * [초보자 설명] 마지막 청크를 언제 멈춰야 하는가?
 * 예전 코드는 `start < text.length` 인 동안 계속 돌았다. 그런데 겹침(overlap)이 크면
 * 끝부분에서 이미 다 담은 내용을 다시 담는 쓸모없는 청크가 생긴다.
 *   slidingChunk("abcdefghij", 4, 3) → ..., 'ghij', 'hij', 'ij', 'j'
 * 'ghij' 를 이미 넣었으므로 'hij', 'ij', 'j' 는 새로운 내용이 하나도 없는 중복이다.
 * 이런 부스러기 청크가 벡터 DB 에 들어가면 검색 결과 상위를 의미 없이 차지한다.
 * 그래서 "이번 청크가 이미 글의 끝까지 닿았으면" 거기서 멈춘다.
 */
export function slidingChunk(text: string, size: number, overlap: number): string[] {
  if (size <= 0) throw new Error("size 는 1 이상이어야 합니다")
  if (overlap >= size) throw new Error("overlap 은 size 보다 작아야 합니다")
  if (overlap < 0) throw new Error("overlap 은 0 이상이어야 합니다")

  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    // 방금 담은 청크가 글의 끝까지 닿았다면 더 만들어봐야 중복뿐이다.
    if (start + size >= text.length) break
    start += size - overlap
  }
  return chunks
}
