import { embedder } from "../chroma.js"
import { cosineDistance } from "../print.js"

/**
 * 의미가 바뀌는 지점에서 자른다. (강의 27)
 *
 * 인접한 두 문장의 임베딩 거리를 재서, 거리가 threshold 를 넘으면
 * "화제가 바뀌었다"고 보고 청크를 끊는다.
 * 문장마다 임베딩을 만들어야 해서 다른 전략보다 느리고 비싸다.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function semanticChunks(
  text: string,
  threshold = 0.35,
  maxChars = 600,
): Promise<string[]> {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []

  const vectors = await embedder.generate(sentences)
  const chunks: string[] = []
  let buffer = sentences[0] ?? ""

  for (let i = 1; i < sentences.length; i++) {
    const prev = vectors[i - 1]
    const curr = vectors[i]
    const sentence = sentences[i] ?? ""
    const distance = prev && curr ? cosineDistance(prev, curr) : 0
    const wouldOverflow = buffer.length + sentence.length > maxChars

    if (distance > threshold || wouldOverflow) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer += " " + sentence
    }
  }
  chunks.push(buffer)

  return chunks
}
