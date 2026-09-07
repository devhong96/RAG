import { ChromaNotFoundError, type Collection } from "chromadb"
import { client, embedder } from "./chroma.js"
import { chunkText } from "./chunking/fixed.js"
import { incrementalUpsert, type IncrementalStats } from "./incremental.js"

/**
 * Express 서버가 쓰는 문서 서비스. (강의 22~24)
 * 컬렉션 핸들을 캐싱해서 요청마다 getOrCreate 를 반복하지 않는다.
 */
// [자바 노트] Map<K, V> 는 자바와 거의 같다. 여기 담는 값이 Collection 이 아니라
//            Promise<Collection> 인 점에 주의. "결과"가 아니라 "진행 중인 작업"을 캐싱한다.
//            그래야 동시에 여러 요청이 와도 getOrCreate 가 한 번만 실행된다.
//            (자바로 치면 CompletableFuture 를 캐싱하는 것)
const collectionCache = new Map<string, Promise<Collection>>()

/**
 * [초보자 설명] 이 함수에 async 가 없는 게 실수처럼 보이지만 의도한 것이다.
 *
 * 캐시에 담는 값이 Collection(결과)이 아니라 Promise<Collection>(진행 중인 작업)이라는 게 핵심이다.
 * 만약 async 함수로 만들고 `await` 한 결과를 캐시에 넣으면 이런 일이 생긴다.
 *
 *   요청1: 캐시 비어있음 → getOrCreate 시작 (아직 안 끝남)
 *   요청2: 캐시 여전히 비어있음 → getOrCreate 또 시작  ← 중복 실행
 *
 * 서버에는 요청이 동시에 들어오므로 이런 겹침이 실제로 일어난다.
 * 반면 "시작하자마자 Promise 를 캐시에 넣어두면" 요청2 는 진행 중인 그 Promise 를
 * 그대로 받아가서 함께 기다린다. 결과적으로 getOrCreate 는 딱 한 번만 실행된다.
 *
 * [자바 노트] CompletableFuture 를 캐싱하는 것과 정확히 같은 패턴이다.
 */
export function getCollection(name: string): Promise<Collection> {
  const cached = collectionCache.get(name)
  if (cached) return cached

  const promise = client
    .getOrCreateCollection({
      name,
      embeddingFunction: embedder,
      metadata: { "hnsw:space": "cosine" },
    })
    .catch((error) => {
      // 실패한 promise 가 캐시에 남으면 영원히 실패한다
      collectionCache.delete(name)
      throw error
    })

  collectionCache.set(name, promise)
  return promise
}

/**
 * 캐시에서 컬렉션 핸들을 버린다. 다음 호출 때 새로 만든다.
 *
 * [초보자 설명] 왜 이런 게 필요한가?
 * 위 캐시는 "이 이름의 컬렉션 핸들"을 한 번 만들어두고 계속 재사용한다.
 * 그런데 컬렉션은 서버 바깥에서 사라질 수 있다. 대표적인 경우가
 * `npm run server` 를 띄워둔 채 다른 터미널에서 `npm run reset` 을 실행하는 것이다.
 * 그러면 Chroma 쪽 컬렉션은 사라졌는데 우리 Map 에는 죽은 핸들이 그대로 남는다.
 * 이 상태에서 요청이 오면 계속 그 죽은 핸들을 써서 영원히 실패한다.
 * (서버를 재시작해야만 풀리는, 초보자가 원인을 찾기 매우 어려운 증상이다.)
 */
export function invalidateCollection(name: string): void {
  collectionCache.delete(name)
}

/** 캐시를 통째로 비운다. */
export function invalidateAllCollections(): void {
  collectionCache.clear()
}

/**
 * 컬렉션 작업을 실행하되, 컬렉션이 사라졌으면 캐시를 버리고 딱 한 번 다시 시도한다.
 *
 * [초보자 설명] Chroma 는 없는 컬렉션에 접근하면 ChromaNotFoundError 를 던진다.
 * 그 에러가 나면 "우리가 들고 있던 핸들이 낡았다"는 뜻이므로, 캐시를 비우고
 * getOrCreateCollection 을 다시 불러 새 컬렉션을 만든 뒤 한 번 더 시도한다.
 * 재시도를 한 번으로 제한하는 이유는, 진짜 서버 문제일 때 무한 반복에 빠지지 않기 위해서다.
 *
 * [자바 노트] <T> 는 제네릭이다. 자바의 <T> T doWith(Function<Collection, T> fn) 과 같다.
 *            fn 이 무엇을 반환하든 그 타입 그대로 돌려준다.
 */
async function withCollection<T>(
  name: string,
  fn: (collection: Collection) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getCollection(name))
  } catch (error) {
    if (!(error instanceof ChromaNotFoundError)) throw error

    // 컬렉션이 밖에서 지워졌다. 낡은 핸들을 버리고 새로 열어서 한 번만 재시도한다.
    invalidateCollection(name)
    return await fn(await getCollection(name))
  }
}

/** [자바 노트] 응답 DTO 자리. record 클래스라고 보면 된다. */
export interface SearchResult {
  id: string
  document: string
  distance: number
  metadata: Record<string, unknown> | null
}

export async function searchDocuments(
  collectionName: string,
  query: string,
  nResults = 5,
  where?: Record<string, unknown>,
): Promise<SearchResult[]> {
  const result = await withCollection(collectionName, (collection) =>
    collection.query({
      queryTexts: [query],
      nResults,
      ...(where ? { where: where as never } : {}),
    }),
  )

  // [자바 노트] result.ids 는 2차원 배열이다. query() 는 질의를 여러 개 받을 수 있어서
  //            "질의별 결과"의 배열이 되고, 우리는 질의가 하나뿐이라 [0] 만 쓴다.
  const ids = result.ids[0] ?? []
  const documents = result.documents?.[0] ?? []
  const distances = result.distances?.[0] ?? []
  const metadatas = result.metadatas?.[0] ?? []

  return ids.map((id, i) => ({
    id,
    document: documents[i] ?? "",
    distance: distances[i] ?? 1,
    metadata: (metadatas[i] as Record<string, unknown> | null) ?? null,
  }))
}

export interface IngestInput {
  source: string
  text: string
  metadata?: Record<string, unknown>
}

/**
 * 같은 source 를 다시 넣으면 이전 청크를 갈아끼운다 (멱등).
 *
 * id 에 타임스탬프를 넣으면 재인제스트할 때마다 새 id 가 생겨서
 * upsert 가 아니라 중복 적재가 된다. id 는 source+순번으로 고정하고,
 * 시각은 메타데이터에만 남긴다.
 *
 * 문서가 짧아지면 예전의 뒤쪽 청크가 남을 수 있다. 그렇다고 기존 청크를 먼저
 * 전부 지우면 새 저장 실패 시 복구할 원본도 사라진다. 따라서 다음 순서를 쓴다.
 *   1. 기존 ID 목록 조회
 *   2. 새 청크 upsert
 *   3. 새 목록에 없는 예전 ID만 삭제
 * 이 방식은 트랜잭션은 아니지만, 실패했을 때 "전부 사라짐"보다 "일부 예전 청크가 잠시 남음"을
 * 선택한다. 후자는 같은 문서를 다시 인제스트하면 스스로 복구된다.
 *
 * 저장은 증분(incremental)으로 한다. 내용이 그대로인 청크는 다시 임베딩하지 않는다.
 * 자세한 이유는 `src/lib/incremental.ts` 참고. 반환값의 stats 로 몇 개를 건너뛰었는지 볼 수 있다.
 */
export async function ingestDocument(
  collectionName: string,
  input: IngestInput,
  now: number = Date.now(),
): Promise<{ chunkCount: number; ids: string[]; stats: IncrementalStats }> {
  const source = input.source.trim()
  if (!source) throw new Error("source는 비어 있지 않은 문자열이어야 합니다")

  const chunks = chunkText(input.text, 120)
  if (chunks.length === 0) throw new Error("text에서 저장할 내용을 찾을 수 없습니다")

  const ids = chunks.map((_, i) => `${source}-chunk-${i}`)
  const pending = chunks.map((text, i) => ({
    id: ids[i] as string,
    text,
    metadata: {
      // 객체 펼치기에서는 뒤에 나온 키가 앞의 같은 키를 덮어쓴다.
      // 시스템 필드를 마지막에 둬야 metadata.source="다른 값" 같은 입력에도 멱등성 기준이 유지된다.
      ...input.metadata,
      source,
      chunkIdx: i,
    },
    // 적재 시각은 매번 달라지므로 지문 계산에서 빼야 증분 인덱싱이 동작한다.
    volatileMetadata: { ingestedAt: now },
  }))

  const stats = await withCollection(collectionName, (collection) =>
    incrementalUpsert(collection, source, pending),
  )

  return { chunkCount: chunks.length, ids, stats }
}
