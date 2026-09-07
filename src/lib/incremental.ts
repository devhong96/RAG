import { createHash } from "node:crypto"
import type { Collection } from "chromadb"

/**
 * 증분 인덱싱 (Incremental Indexing).
 *
 * [초보자 설명] 지금까지 이 저장소의 인제스트는 전부 "다시 넣기"였다.
 * 위키 문서 한 문단만 고쳐도 그 문서의 청크를 전부 다시 임베딩했다.
 * 문제는 임베딩이 이 파이프라인에서 가장 비싼 단계라는 점이다.
 * 청크 하나당 Ollama 호출이 한 번씩 들어가므로, 청크 200개짜리 문서를 다시 넣으면
 * 실제로 바뀐 게 한 청크뿐이어도 200번을 다시 계산한다.
 *
 * 증분 인덱싱은 "바뀐 것만 다시 넣는다"는 아주 단순한 아이디어다.
 * 청크를 저장할 때 그 내용의 지문(해시)을 메타데이터에 같이 남겨두고,
 * 다음에 넣을 때 지문을 비교해서 같으면 건너뛴다.
 *
 *   기존 저장분:  a(해시1)  b(해시2)  c(해시3)
 *   새로 만든 것: a(해시1)  b(해시9)            d(해시4)
 *                 --------  ---------  -------  ---------
 *                 그대로     내용 바뀜   사라짐    새로 생김
 *                 (건너뜀)   (다시 넣음) (지움)    (넣음)
 *
 * 이렇게 하면 임베딩 호출이 "바뀐 청크 수"에 비례한다.
 *
 * [자바 노트] 스프링 배치의 증분 처리(마지막 처리 시각 이후만 읽기)와 목적이 같다.
 *            다만 여기서는 시각 대신 내용 해시를 기준으로 삼는다. 시각 기준은
 *            "내용은 그대로인데 파일을 다시 저장한 경우"를 걸러내지 못하기 때문이다.
 */

/** 청크 메타데이터에 지문을 담는 키. */
export const HASH_KEY = "contentHash"

/**
 * 객체를 키 순서에 상관없이 항상 같은 문자열로 만든다.
 *
 * [초보자 설명] JSON.stringify 는 키가 들어간 순서대로 찍는다.
 * `{a:1, b:2}` 와 `{b:2, a:1}` 은 내용이 같은데도 다른 문자열이 되고,
 * 그러면 해시가 달라져서 "안 바뀐 청크"가 바뀐 것으로 잘못 판정된다.
 * 그래서 키를 정렬해서 순서를 고정한 뒤 문자열로 만든다.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== HASH_KEY) // 지문 자체는 지문 계산에서 뺀다
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => `${JSON.stringify(key)}:${stableStringify(v)}`)
  return `{${entries.join(",")}}`
}

/**
 * 청크 내용의 지문을 만든다.
 *
 * 본문뿐 아니라 메타데이터도 함께 넣는 이유: 본문은 그대로인데 heading 이나 title 같은
 * 메타데이터만 바뀌는 경우가 있다. 본문만 해시하면 그 변경이 영영 반영되지 않는다.
 * 12자만 쓰는 이유는 이 규모의 학습 예제에서 충돌 가능성이 사실상 없고(2^48),
 * 메타데이터를 눈으로 확인할 때 짧은 편이 읽기 좋기 때문이다.
 */
export function contentHash(text: string, metadata?: Record<string, unknown>): string {
  const payload = metadata ? `${text} ${stableStringify(metadata)}` : text
  return createHash("sha256").update(payload).digest("hex").slice(0, 12)
}

/** 적재하려는 청크 하나. */
export interface PendingChunk {
  id: string
  text: string
  metadata?: Record<string, unknown>
  /**
   * 저장은 하되 지문 계산에서는 빼는 메타데이터.
   *
   * [초보자 설명] 적재 시각(`ingestedAt`) 같은 값이 여기 들어간다.
   * 이런 값은 인제스트할 때마다 달라지므로, 지문에 넣으면 내용이 하나도 안 바뀌었는데도
   * 매번 "바뀌었다"고 판정돼 증분 인덱싱이 아무 효과를 못 낸다.
   * 반대로 저장까지 안 하면 "이 청크가 언제 들어왔는지"를 알 수 없으니, 나눠서 다룬다.
   * 건너뛴 청크는 이 값이 갱신되지 않으므로 자연스럽게 "마지막으로 내용이 바뀐 시각"이 된다.
   */
  volatileMetadata?: Record<string, unknown>
}

/** 이미 저장돼 있는 청크의 지문. id -> 해시(없을 수도 있음). */
export type ExistingHashes = ReadonlyMap<string, string | undefined>

export interface IncrementalPlan {
  /** 새로 생겼거나 내용이 바뀌어 다시 임베딩해야 하는 청크. */
  changed: PendingChunk[]
  /** 지문이 같아서 건너뛰는 청크의 id. */
  unchangedIds: string[]
  /** 새 목록에 없어서 지워야 하는 예전 청크의 id. */
  staleIds: string[]
}

/**
 * 무엇을 다시 넣고, 무엇을 건너뛰고, 무엇을 지울지 계산한다.
 *
 * 이 함수는 DB 를 건드리지 않는 순수 함수다. 그래서 Chroma 없이 테스트할 수 있고,
 * 실제 적재 전에 "이번에 몇 개가 바뀌었는지"만 미리 보여줄 수도 있다.
 */
export function planIncrementalUpsert(
  chunks: readonly PendingChunk[],
  existing: ExistingHashes,
): IncrementalPlan {
  const changed: PendingChunk[] = []
  const unchangedIds: string[] = []
  const currentIds = new Set<string>()

  for (const chunk of chunks) {
    currentIds.add(chunk.id)
    const hash = contentHash(chunk.text, chunk.metadata)
    // 예전 청크에 지문이 없으면(증분 인덱싱 도입 전에 넣은 데이터) 비교할 근거가 없으므로
    // 안전한 쪽인 "바뀐 것으로 보고 다시 넣기"를 택한다. 한 번 다시 넣고 나면
    // 지문이 생기므로 그다음부터는 정상적으로 건너뛴다.
    if (existing.get(chunk.id) === hash) {
      unchangedIds.push(chunk.id)
      continue
    }
    changed.push({
      ...chunk,
      metadata: { ...chunk.metadata, ...chunk.volatileMetadata, [HASH_KEY]: hash },
    })
  }

  const staleIds = [...existing.keys()].filter((id) => !currentIds.has(id))
  return { changed, unchangedIds, staleIds }
}

export interface IncrementalStats {
  /** 다시 임베딩해서 저장한 청크 수. */
  changed: number
  /** 지문이 같아 건너뛴 청크 수. 그대로 아낀 임베딩 호출 수이기도 하다. */
  unchanged: number
  /** 지운 예전 청크 수. */
  removed: number
}

/**
 * 한 출처(source)의 청크를 증분 방식으로 적재한다.
 *
 * 순서는 기존 인제스트와 같은 원칙을 지킨다.
 *   1. 기존 청크의 지문 조회
 *   2. 바뀐 것만 upsert
 *   3. 성공한 뒤에 남은 예전 청크 삭제
 * 저장이 실패했을 때 "전부 사라짐"이 아니라 "예전 청크가 잠시 남음"이 되도록 한 것이다.
 */
export async function incrementalUpsert(
  collection: Collection,
  source: string,
  chunks: readonly PendingChunk[],
): Promise<IncrementalStats> {
  const previous = await collection.get({ where: { source } })
  const existing = new Map<string, string | undefined>()
  previous.ids.forEach((id, i) => {
    const meta = previous.metadatas?.[i] as Record<string, unknown> | null | undefined
    const hash = meta?.[HASH_KEY]
    existing.set(id, typeof hash === "string" ? hash : undefined)
  })

  const plan = planIncrementalUpsert(chunks, existing)

  if (plan.changed.length > 0) {
    await collection.upsert({
      ids: plan.changed.map((c) => c.id),
      documents: plan.changed.map((c) => c.text),
      metadatas: plan.changed.map((c) => (c.metadata ?? {}) as Record<string, string | number | boolean>),
    })
  }
  if (plan.staleIds.length > 0) {
    await collection.delete({ ids: plan.staleIds })
  }

  return {
    changed: plan.changed.length,
    unchanged: plan.unchangedIds.length,
    removed: plan.staleIds.length,
  }
}

/** 사람이 읽을 한 줄 요약. 스크립트 로그에 쓴다. */
export function formatStats(stats: IncrementalStats): string {
  return `변경 ${stats.changed} / 건너뜀 ${stats.unchanged} / 삭제 ${stats.removed}`
}
