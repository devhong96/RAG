import type { Collection } from "chromadb"
import { config } from "../../config.js"

/**
 * 크로스 인코더 재랭킹. (강의 29~30)
 *
 * 임베딩(bi-encoder)은 질의와 문서를 따로 벡터화해서 비교한다. 빠르지만 천장이 있다.
 * 크로스 인코더는 질의와 문서를 함께 넣어 관련도를 직접 예측한다. 정확하지만 느리다.
 * 그래서 2단계로 쓴다 — 벡터 검색으로 후보를 넓게 뽑고, 그 후보만 재랭킹한다.
 *
 * 주의: Ollama 가 아니라 @xenova/transformers 로 로컬 실행된다.
 * 첫 실행 시 모델을 config.reranker.cacheDir 에 내려받는다.
 */
let cachedTokenizer: unknown = null
let cachedModel: unknown = null

async function load() {
  if (!cachedTokenizer || !cachedModel) {
    const { AutoTokenizer, AutoModelForSequenceClassification, env } = await import(
      "@xenova/transformers"
    )
    env.cacheDir = config.reranker.cacheDir
    cachedTokenizer = await AutoTokenizer.from_pretrained(config.reranker.modelId)
    cachedModel = await AutoModelForSequenceClassification.from_pretrained(config.reranker.modelId)
  }
  return { tokenizer: cachedTokenizer as any, model: cachedModel as any }
}

/**
 * 질의-문서 쌍마다 관련도 점수를 낸다. 점수가 클수록 관련이 높다.
 *
 * [초보자 설명] 반환되는 점수는 0~1 이 아니라 -10 ~ +10 같은 제한 없는 값(logit)이다.
 * 그래서 "-3.32점"이 나와도 나쁜 게 아니다. 절댓값에는 의미가 없고,
 * 같은 질문 안에서 후보들끼리 비교할 때의 순서만 의미가 있다.
 * (확률처럼 보고 싶다면 시그모이드를 씌워야 하는데, 순위만 필요하면 그럴 이유가 없다.)
 */
export async function rerankScores(query: string, docs: string[]): Promise<number[]> {
  if (docs.length === 0) return []
  const { tokenizer, model } = await load()
  // [초보자 설명] docs.map(() => query) 는 질문을 문서 개수만큼 복제한다.
  // 크로스 인코더는 (질문, 문서) 쌍을 입력으로 받으므로 왼쪽에 같은 질문을 문서 수만큼 늘어놓고,
  // text_pair 로 오른쪽에 문서들을 짝지어 한 번에 처리한다(배치 처리).
  //   질문 A + 문서1
  //   질문 A + 문서2  ...
  // padding: 길이가 다른 문장들을 같은 길이로 맞춘다(짧은 쪽을 빈 값으로 채움).
  // truncation: 모델이 받을 수 있는 최대 길이를 넘으면 잘라낸다.
  const inputs = tokenizer(
    docs.map(() => query),
    { text_pair: docs, padding: true, truncation: true },
  )
  const output = await model(inputs)
  return Array.from(output.logits.data as Float32Array)
}

export interface RerankedHit {
  id: string
  doc: string
  score: number
}

/**
 * 2단계 파이프라인.
 *
 * [초보자 설명] 왜 굳이 두 단계로 나눌까? 처음부터 정확한 걸 쓰면 되지 않나?
 *
 * 크로스 인코더는 "질문 + 문서" 한 쌍마다 모델을 한 번씩 돌린다.
 * 문서가 10만 개면 10만 번 돌려야 해서 현실적으로 불가능하다.
 * 반면 임베딩(bi-encoder)은 문서 벡터를 미리 만들어 저장해두므로,
 * 검색할 때는 질문 벡터 하나만 만들어 비교하면 된다. 10만 개도 순식간이다.
 *
 * 그래서 역할을 나눈다.
 *   1단계 — 빠른 벡터 검색으로 10만 개에서 30개로 줄인다 (정확도는 좀 떨어져도 됨)
 *   2단계 — 그 30개만 크로스 인코더로 정밀하게 다시 줄 세운다 (30번만 돌리면 됨)
 * 이런 구조를 "넓게 뽑고 좁히기(retrieve and rerank)"라고 부른다.
 *
 * candidates 를 키우면 1단계에서 놓칠 확률은 줄지만 2단계가 그만큼 느려진다.
 * 이 맞바꿈을 숫자로 확인하는 게 measureLatency(lib/eval/metrics.ts)가 하는 일이다.
 *
 * @param candidates 1단계에서 뽑을 후보 수 (넓을수록 정확하지만 느려진다)
 * @param topK 재랭킹 후 남길 개수
 */
export async function searchWithRerank(
  collection: Collection,
  query: string,
  candidates = 30,
  topK = 5,
): Promise<RerankedHit[]> {
  const initial = await collection.query({
    queryTexts: [query],
    nResults: candidates,
    include: ["documents"] as const,
  })

  const rawIds = initial.ids[0] ?? []
  const rawDocs = initial.documents?.[0] ?? []
  const pairs = rawIds
    .map((id, i) => ({ id, doc: rawDocs[i] }))
    .filter((p): p is { id: string; doc: string } => typeof p.doc === "string")

  const scores = await rerankScores(query, pairs.map((p) => p.doc))

  return pairs
    .map((p, i) => ({ ...p, score: scores[i] ?? -Infinity }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
