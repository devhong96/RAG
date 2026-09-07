import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Collection } from "chromadb"
import { chunkText, slidingChunk } from "./chunking/fixed.js"
import { evaluateMRR, evaluateRetrieval, evaluateTopK } from "./eval/metrics.js"
import { KnowledgeGraph } from "./graph/knowledge-graph.js"
import { rrfMerge } from "./search/hybrid.js"
import { normalizeWhere } from "./search/self-query.js"

/**
 * 외부 서비스 없이 반복 실행할 수 있는 단위 테스트 모음.
 *
 * Chroma/Ollama 연결 테스트와 달리 순수 함수는 입력만 같으면 결과가 항상 같다.
 * 이런 로직을 먼저 빠르게 검증해 두면 통합 실습 실패가 알고리즘 문제인지 인프라 문제인지
 * 구분하기 쉬워진다. `npm test`는 DB를 띄우지 않아도 실행할 수 있다.
 */
describe("청킹", () => {
  it("문장부호가 없는 긴 텍스트도 최대 크기를 지킨다", () => {
    const chunks = chunkText("가".repeat(250), 120)
    assert.deepEqual(chunks.map((chunk) => chunk.length), [120, 120, 10])
  })

  it("슬라이딩 청킹은 글 끝에 도달한 뒤 중복 조각을 만들지 않는다", () => {
    assert.deepEqual(slidingChunk("abcdefghij", 4, 3), [
      "abcd",
      "bcde",
      "cdef",
      "defg",
      "efgh",
      "fghi",
      "ghij",
    ])
  })
})

describe("검색 보조 로직", () => {
  it("여러 메타데이터 조건을 Chroma의 $and 형식으로 바꾼다", () => {
    assert.deepEqual(normalizeWhere({ category: "coffee", year: { $gte: 2024 } }), {
      $and: [{ category: "coffee" }, { year: { $gte: 2024 } }],
    })
  })

  it("RRF는 여러 검색에서 반복해서 상위권인 문서를 먼저 둔다", () => {
    assert.deepEqual(rrfMerge([["a", "b", "c"], ["b", "c", "d"]]).slice(0, 2), ["b", "c"])
  })
})

describe("평가 지표", () => {
  // 빈 배열이면 함수가 조기 반환하므로 실제 Collection 메서드는 호출되지 않는다.
  // 이 가짜 객체는 "외부 DB가 없어도 경계값 정책을 검사할 수 있다"는 테스트 대역의 예다.
  const unusedCollection = {} as Collection

  it("빈 평가셋은 NaN 대신 0을 반환한다", async () => {
    assert.equal(await evaluateTopK(unusedCollection, [], 3), 0)
    assert.equal(await evaluateMRR(unusedCollection, []), 0)
    assert.deepEqual(await evaluateRetrieval([], async () => []), { recall: 0, mrr: 0 })
  })
})

describe("지식 그래프", () => {
  it("양방향으로 탐색하면서 각 관계의 깊이를 보존한다", () => {
    const graph = new KnowledgeGraph()
      .addRelation("A", "연결", "B")
      .addRelation("B", "연결", "C")

    assert.deepEqual(graph.traverse("A", 2), [
      { source: "A", relation: "연결", target: "B", depth: 1 },
      { source: "B", relation: "연결", target: "C", depth: 2 },
    ])
  })
})
