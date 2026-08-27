import type { Collection } from "chromadb"
import { rerankScores, type RerankedHit } from "./rerank.js"
import { KnowledgeGraph } from "../graph/knowledge-graph.js"
import { chatComplete, type ChatMessage } from "../llm.js"

/**
 * Graph-RAG + Re-ranker 2단계 파이프라인.
 *
 * 1단계 (하이브리드 후보 검색):
 *   - 벡터 검색(Chroma): 문맥/의미 기반 유사 텍스트 청크 수집
 *   - 그래프 탐색(KnowledgeGraph): 질문 내 엔티티 중심의 다단계(Multi-hop) 연결 사실(Facts) 수집
 *   - 두 출처의 후보를 하나의 풀로 병합
 *
 * 2단계 (크로스 인코더 재랭킹):
 *   - 병합된 후보 전체를 Cross-Encoder(리랭커)에 넣어 질문과의 정밀 관련도 점수 측정
 *   - 가장 적합한 상위 Top-K 개만 추려서 LLM 컨텍스트로 전달
 */

export interface GraphRAGCandidate {
  id: string
  text: string
  sourceType: "vector" | "graph"
}

export interface GraphRAGHit extends GraphRAGCandidate {
  score: number
}

export interface GraphRAGOptions {
  vectorCandidates?: number // 1단계 벡터 검색 후보 수 (기본: 10)
  graphDepth?: number // 1단계 그래프 탐색 깊이 (기본: 2 hop)
  topK?: number // 2단계 리랭커 통과 후 최종 상위 개수 (기본: 5)
}

/**
 * 벡터 검색 + 그래프 탐색 + 크로스 인코더 재랭킹 통합 검색.
 */
export async function searchGraphRAG(
  collection: Collection,
  graph: KnowledgeGraph,
  query: string,
  options: GraphRAGOptions = {},
): Promise<GraphRAGHit[]> {
  const { vectorCandidates = 10, graphDepth = 2, topK = 5 } = options

  // 1-A. 벡터 검색으로 의미적 유사 청크 수집
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

  // 1-B. 지식 그래프 탐색으로 흩어진 관계 팩트(Fact) 수집
  const graphTriples = graph.search(query, graphDepth)
  const graphFacts = KnowledgeGraph.triplesToFacts(graphTriples)

  const graphPool: GraphRAGCandidate[] = graphFacts.map((fact, i) => ({
    id: `graph-fact-${i + 1}`,
    text: fact,
    sourceType: "graph" as const,
  }))

  // 1-C. 후보군 병합
  const candidatePool: GraphRAGCandidate[] = [...vectorPool, ...graphPool]

  if (candidatePool.length === 0) return []

  // 2단계. 크로스 인코더로 모든 후보에 대한 질문 관련도 정밀 채점
  const scores = await rerankScores(
    query,
    candidatePool.map((c) => c.text),
  )

  // 점수 기준 내림차순 정렬 후 Top-K 추출
  return candidatePool
    .map((item, idx) => ({
      ...item,
      score: scores[idx] ?? -Infinity,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/**
 * 리랭킹된 검색 결과(벡터 청크 + 그래프 팩트)를 LLM 프롬프트용 컨텍스트로 조합한다.
 */
export function buildGraphRAGContext(hits: GraphRAGHit[]): string {
  return hits
    .map((h, i) => {
      const typeLabel = h.sourceType === "graph" ? "[지식 관계망]" : "[문서 본문]"
      return `[자료 ${i + 1} - ${typeLabel}, 관련도 점수: ${h.score.toFixed(2)}]\n${h.text}`
    })
    .join("\n\n")
}

/**
 * 지식 그래프 + 벡터 + 리랭커를 거쳐 최종 LLM 답변을 생성하는 RAG 함수.
 */
export async function answerWithGraphRAG(
  collection: Collection,
  graph: KnowledgeGraph,
  question: string,
  options: GraphRAGOptions = {},
): Promise<{ answer: string; context: string; hits: GraphRAGHit[] }> {
  const hits = await searchGraphRAG(collection, graph, question, options)
  const context = buildGraphRAGContext(hits)

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 문서 청크와 지식 그래프 관계망을 종합하여 질문에 답변하는 전문가 AI입니다.
다음 규칙을 엄격히 지켜 주세요.
1. 주어진 [자료]에 있는 내용만을 근거로 정확하게 답변하세요.
2. 문서 본문과 지식 관계망(Fact)의 연결 고리를 논리적으로 종합하여 답변을 구성하세요.
3. 자료에 명시되지 않은 추측이나 외부 지식은 포함하지 마세요.
4. 명확하고 군더더기 없는 한국어로 답변하세요.`,
    },
    {
      role: "user",
      content: `다음 자료들을 참고하여 질문에 답해 주세요.\n\n${context}\n\n[질문]\n${question}`,
    },
  ]

  const answer = await chatComplete(messages)
  return { answer, context, hits }
}
