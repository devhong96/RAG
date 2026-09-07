import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Collection } from "chromadb"
import { chunkText, slidingChunk } from "./chunking/fixed.js"
import { evaluateMRR, evaluateRetrieval, evaluateTopK } from "./eval/metrics.js"
import { KnowledgeGraph } from "./graph/knowledge-graph.js"
import { ConversationStore, formatHistory, trimHistory } from "./conversation.js"
import { contentHash, planIncrementalUpsert } from "./incremental.js"
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

describe("증분 인덱싱", () => {
  const chunks = [
    { id: "doc-0", text: "첫 문단", metadata: { source: "doc" } },
    { id: "doc-1", text: "둘째 문단", metadata: { source: "doc" } },
  ]

  it("처음 넣을 때는 전부 변경으로 잡는다", () => {
    const plan = planIncrementalUpsert(chunks, new Map())
    assert.deepEqual(plan.changed.map((c) => c.id), ["doc-0", "doc-1"])
    assert.deepEqual(plan.unchangedIds, [])
  })

  it("내용이 그대로면 건너뛰고, 바뀐 청크만 다시 넣는다", () => {
    const existing = new Map(chunks.map((c) => [c.id, contentHash(c.text, c.metadata)]))
    const next = [chunks[0]!, { ...chunks[1]!, text: "둘째 문단 (수정됨)" }]

    const plan = planIncrementalUpsert(next, existing)
    assert.deepEqual(plan.unchangedIds, ["doc-0"])
    assert.deepEqual(plan.changed.map((c) => c.id), ["doc-1"])
  })

  it("새 목록에서 사라진 청크는 삭제 대상이 된다", () => {
    const existing = new Map(chunks.map((c) => [c.id, contentHash(c.text, c.metadata)]))
    assert.deepEqual(planIncrementalUpsert([chunks[0]!], existing).staleIds, ["doc-1"])
  })

  it("지문이 없는 예전 데이터는 안전하게 다시 넣는다", () => {
    const existing = new Map<string, string | undefined>([["doc-0", undefined]])
    assert.deepEqual(planIncrementalUpsert([chunks[0]!], existing).changed.length, 1)
  })

  it("메타데이터 키 순서가 달라도 같은 지문이 나온다", () => {
    assert.equal(contentHash("본문", { a: 1, b: 2 }), contentHash("본문", { b: 2, a: 1 }))
  })

  it("적재 시각처럼 매번 바뀌는 값은 지문에 영향을 주지 않는다", () => {
    const base = { id: "doc-0", text: "첫 문단", metadata: { source: "doc" } }
    const existing = new Map([["doc-0", contentHash(base.text, base.metadata)]])
    const plan = planIncrementalUpsert(
      [{ ...base, volatileMetadata: { ingestedAt: Date.now() } }],
      existing,
    )
    assert.deepEqual(plan.unchangedIds, ["doc-0"])
  })
})

describe("대화 기록", () => {
  const turn = (i: number) => [
    { role: "user", content: `질문${i}` } as const,
    { role: "assistant", content: `답변${i}` } as const,
  ]

  it("최근 N턴만 남기되 사용자/AI 짝을 깨지 않는다", () => {
    const history = [1, 2, 3, 4].flatMap(turn)
    const trimmed = trimHistory(history, 2)
    assert.equal(trimmed.length, 4)
    assert.equal(trimmed[0]?.content, "질문3")
    assert.equal(trimmed[0]?.role, "user")
  })

  it("기록이 한도보다 짧으면 그대로 둔다", () => {
    assert.deepEqual(trimHistory(turn(1), 5), turn(1))
  })

  it("프롬프트에 넣을 때 화자를 붙인다", () => {
    assert.equal(formatHistory(turn(1)), "사용자: 질문1\nAI: 답변1")
  })

  it("세션마다 기록이 섞이지 않고, clear 로 비워진다", () => {
    const store = new ConversationStore(2)
    store.append("a", "질문A", "답변A")
    store.append("b", "질문B", "답변B")
    assert.equal(store.get("a").length, 2)
    assert.equal(store.get("a")[0]?.content, "질문A")

    store.clear("a")
    assert.deepEqual(store.get("a"), [])
    assert.equal(store.get("b").length, 2)
  })

  it("한도를 넘으면 오래된 턴부터 버린다", () => {
    const store = new ConversationStore(1)
    store.append("a", "옛질문", "옛답변")
    store.append("a", "새질문", "새답변")
    assert.deepEqual(store.get("a").map((m) => m.content), ["새질문", "새답변"])
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
