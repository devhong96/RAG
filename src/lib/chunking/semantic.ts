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

/**
 * @param threshold 이 값보다 인접 문장 거리가 크면 "화제가 바뀌었다"고 보고 끊는다.
 *   [초보자 설명] 거리는 0(똑같은 의미)에서 2(정반대) 사이의 값이다.
 *   threshold 를 낮추면(0.2) 조금만 달라져도 끊어서 청크가 잘게 많아지고,
 *   높이면(0.6) 웬만해선 안 끊어서 청크가 크고 적어진다.
 *   정답은 없고 문서 성격에 맞춰 실험으로 찾는 값이다.
 * @param maxChars 화제가 안 바뀌어도 이 길이를 넘으면 강제로 끊는다.
 *   [초보자 설명] 한 주제로 길게 이어지는 글은 threshold 만으로는 영원히 안 끊긴다.
 *   임베딩 모델에는 한 번에 넣을 수 있는 길이 한계가 있으니 상한이 필요하다.
 */
export async function semanticChunks(
  text: string,
  threshold = 0.35,
  maxChars = 600,
): Promise<string[]> {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return []

  // [초보자 설명] 여기가 이 전략이 비싼 이유다.
  // 글자 수로 자르는 방식은 계산이 공짜지만, 이건 "문장 개수만큼" 임베딩을 만들어야 한다.
  // 문장이 100개면 임베딩 API 를 100개 문장에 대해 호출한다.
  // 그래서 인제스트 단계에서 한 번만 쓰고, 검색 때마다 쓰지는 않는다.
  const vectors = await embedder.generate(sentences)
  const chunks: string[] = []
  // buffer 는 "지금 모으고 있는 청크"다. 첫 문장으로 시작해서 뒤 문장을 붙여 나간다.
  let buffer = sentences[0] ?? ""

  // i 를 1부터 시작하는 이유: 앞 문장과 비교해야 하므로 첫 문장은 비교 대상이 없다.
  for (let i = 1; i < sentences.length; i++) {
    const prev = vectors[i - 1]
    const curr = vectors[i]
    const sentence = sentences[i] ?? ""
    // 앞 문장과 지금 문장의 의미가 얼마나 먼가.
    // [자바 노트] prev && curr 는 "둘 다 값이 있으면"이라는 뜻의 널 체크다.
    const distance = prev && curr ? cosineDistance(prev, curr) : 0
    const wouldOverflow = buffer.length + sentence.length > maxChars

    // 화제가 바뀌었거나(distance) 너무 길어졌으면(wouldOverflow) 여기서 끊는다.
    if (distance > threshold || wouldOverflow) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer += " " + sentence
    }
  }
  // 반복문이 끝나면 buffer 에 마지막 청크가 남아 있다. 이걸 빠뜨리면 글의 끝부분이 사라진다.
  chunks.push(buffer)

  return chunks
}
