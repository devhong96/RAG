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

/** 문장 경계(. ! ?)를 지키면서 chunkSize 를 넘지 않게 모은다. */
export function chunkText(text: string, chunkSize = 120): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? " " : "") + sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

/**
 * 겹치게 자른다. size=200, overlap=40 이면 다음 청크가 40자 앞에서 시작한다.
 * 장점: 청크 경계에서 잘려나가는 정보 손실이 줄어든다.
 * 단점: 데이터가 불필요하게 늘어난다.
 */
export function slidingChunk(text: string, size: number, overlap: number): string[] {
  if (overlap >= size) throw new Error("overlap 은 size 보다 작아야 합니다")
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + size))
    start += size - overlap
  }
  return chunks
}
