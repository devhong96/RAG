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

/** 질의-문서 쌍마다 관련도 점수를 낸다. 점수가 클수록 관련이 높다. */
export async function rerankScores(query: string, docs: string[]): Promise<number[]> {
  if (docs.length === 0) return []
  const { tokenizer, model } = await load()
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
