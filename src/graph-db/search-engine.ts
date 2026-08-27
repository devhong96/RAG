import type { Collection } from "chromadb"
import { rerankScores } from "../lib/search/rerank.js"
import { Neo4jKnowledgeGraph } from "./client.js"
import { chatComplete, type ChatMessage } from "../lib/llm.js"

export interface GraphRAGCandidate {
  id: string
  text: string
  sourceType: "vector" | "graph"
}

export interface GraphRAGHit extends GraphRAGCandidate {
  score: number
}

export interface GraphRAGOptions {
  vectorCandidates?: number
  graphDepth?: number
  topK?: number
}

/**
 * 1단계: Chroma 벡터 검색 + Neo4j Cypher 탐색 후보 수집
 * 2단계: Cross-Encoder (BGE-Reranker) 정밀 채점 후 상위 Top-K 선별
 */
export async function searchGraphRAG(
  collection: Collection,
  graph: Neo4jKnowledgeGraph,
  query: string,
  options: GraphRAGOptions = {},
): Promise<GraphRAGHit[]> {
  const { vectorCandidates = 10, graphDepth = 2, topK = 5 } = options

  // 1-A. Chroma 벡터 검색
  const vectorRes = await collection.query({
    queryTexts: [query],
    nResults: vectorCandidates,
    include: ["documents"] as const,
  })

  const rawIds = vectorRes.ids[0] ?? []
  const rawDocs = vectorRes.documents?.[0] ?? []
  const vectorPool: GraphRAGCandidate[] = rawIds
    .map((id, i) => ({
      id,
      text: rawDocs[i] ?? "",
      sourceType: "vector" as const,
    }))
    .filter((c) => c.text.length > 0)

  // 1-B. Neo4j Cypher 지식 그래프 탐색
  const graphTriples = await graph.search(query, graphDepth)
  const graphFacts = Neo4jKnowledgeGraph.triplesToFacts(graphTriples)
  const graphPool: GraphRAGCandidate[] = graphFacts.map((fact, i) => ({
    id: `neo4j-fact-${i + 1}`,
    text: fact,
    sourceType: "graph" as const,
  }))

  const candidatePool = [...vectorPool, ...graphPool]
  if (candidatePool.length === 0) return []

  // 2단계. 크로스 인코더 재랭킹
  const scores = await rerankScores(
    query,
    candidatePool.map((c) => c.text),
  )

  return candidatePool
    .map((item, idx) => ({
      ...item,
      score: scores[idx] ?? -Infinity,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** 프롬프트용 컨텍스트 조합 */
export function buildGraphRAGContext(hits: GraphRAGHit[]): string {
  return hits
    .map((h, i) => {
      const label = h.sourceType === "graph" ? "[지식 관계망 Fact]" : "[문서 본문]"
      return `[자료 ${i + 1} - ${label}, 관련도: ${h.score.toFixed(2)}]\n${h.text}`
    })
    .join("\n\n")
}

/** GraphRAG 최종 질의응답 */
export async function answerWithGraphRAG(
  collection: Collection,
  graph: Neo4jKnowledgeGraph,
  question: string,
  options: GraphRAGOptions = {},
): Promise<{ answer: string; context: string; hits: GraphRAGHit[] }> {
  const hits = await searchGraphRAG(collection, graph, question, options)
  const context = buildGraphRAGContext(hits)

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 문서 청크와 지식 그래프 관계망을 종합하여 질문에 답변하는 전문가 AI입니다.
주어진 [자료]의 내용만을 근거로 사실에 입각하여 정확하고 명확하게 답변하세요.`,
    },
    {
      role: "user",
      content: `다음 자료들을 참고하여 질문에 답해 주세요.\n\n${context}\n\n[질문]\n${question}`,
    },
  ]

  const answer = await chatComplete(messages)
  return { answer, context, hits }
}
