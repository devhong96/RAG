import type { Collection } from "chromadb"
import { client, embedder } from "./chroma.js"
import { chunkText } from "./chunking/fixed.js"

/**
 * Express 서버가 쓰는 문서 서비스. (강의 22~24)
 * 컬렉션 핸들을 캐싱해서 요청마다 getOrCreate 를 반복하지 않는다.
 */
// [자바 노트] Map<K, V> 는 자바와 거의 같다. 여기 담는 값이 Collection 이 아니라
//            Promise<Collection> 인 점에 주의. "결과"가 아니라 "진행 중인 작업"을 캐싱한다.
//            그래야 동시에 여러 요청이 와도 getOrCreate 가 한 번만 실행된다.
//            (자바로 치면 CompletableFuture 를 캐싱하는 것)
const collectionCache = new Map<string, Promise<Collection>>()

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
  const collection = await getCollection(collectionName)
  const result = await collection.query({
    queryTexts: [query],
    nResults,
    ...(where ? { where: where as never } : {}),
  })

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
 * 문서가 짧아져서 청크 수가 줄어드는 경우를 위해 먼저 기존 것을 지운다.
 */
export async function ingestDocument(
  collectionName: string,
  input: IngestInput,
  now: number = Date.now(),
): Promise<{ chunkCount: number; ids: string[] }> {
  const chunks = chunkText(input.text, 120)
  const collection = await getCollection(collectionName)

  await collection.delete({ where: { source: input.source } })

  const ids = chunks.map((_, i) => `${input.source}-chunk-${i}`)
  const metadatas = chunks.map((_, i) => ({
    source: input.source,
    chunkIdx: i,
    ingestedAt: now,
    ...input.metadata,
  }))

  await collection.upsert({ ids, documents: chunks, metadatas })
  return { chunkCount: chunks.length, ids }
}
