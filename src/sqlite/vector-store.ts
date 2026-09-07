import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { topKByCosine } from "../lib/vector-math.js"

export interface SqliteVectorDocument {
  id: string
  text: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface SqliteVectorHit extends SqliteVectorDocument {
  similarity: number
  distance: number
}

/**
 * SQLite로 정형 데이터와 벡터를 한 트랜잭션 안에 보관하는 학습용 저장소.
 *
 * 임베딩은 JSON TEXT로 저장하고 애플리케이션에서 Flat 검색한다. 따라서 정확하지만 O(N)이다.
 * sqlite-vec/VSS 같은 확장을 붙였을 때 무엇이 달라지는지 비교할 수 있는 기준 구현이지,
 * 대규모 서비스용 ANN 인덱스가 아니다.
 */
export class SqliteVectorStore {
  private readonly db: DatabaseSync

  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS vector_documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        dimension INTEGER NOT NULL CHECK (dimension > 0),
        metadata TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_vector_documents_collection
        ON vector_documents(collection);
    `)
  }

  upsert(collection: string, documents: readonly SqliteVectorDocument[]): void {
    if (!collection.trim()) throw new Error("collection은 비어 있을 수 없습니다")
    const existing = this.db
      .prepare("SELECT dimension FROM vector_documents WHERE collection = ? LIMIT 1")
      .get(collection) as { dimension: number } | undefined
    const expectedDimension = existing?.dimension ?? documents[0]?.embedding.length
    const statement = this.db.prepare(`
      INSERT INTO vector_documents(collection, id, text, embedding, dimension, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(collection, id) DO UPDATE SET
        text = excluded.text,
        embedding = excluded.embedding,
        dimension = excluded.dimension,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `)

    this.db.exec("BEGIN")
    try {
      for (const document of documents) {
        if (!document.id.trim()) throw new Error("id는 비어 있을 수 없습니다")
        if (document.embedding.length === 0) throw new Error("embedding은 비어 있을 수 없습니다")
        if (document.embedding.length !== expectedDimension) {
          throw new Error(`컬렉션의 벡터 차원은 ${expectedDimension}이어야 합니다`)
        }
        if (document.embedding.some((value) => !Number.isFinite(value))) {
          throw new Error("embedding에는 유한한 숫자만 들어갈 수 있습니다")
        }
        statement.run(
          collection,
          document.id,
          document.text,
          JSON.stringify(document.embedding),
          document.embedding.length,
          JSON.stringify(document.metadata ?? {}),
        )
      }
      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  search(
    collection: string,
    query: readonly number[],
    k = 5,
    where: Record<string, unknown> = {},
  ): SqliteVectorHit[] {
    const rows = this.db
      .prepare("SELECT id, text, embedding, metadata FROM vector_documents WHERE collection = ?")
      .all(collection) as { id: string; text: string; embedding: string; metadata: string }[]

    const candidates = rows
      .map((row) => ({
        id: row.id,
        text: row.text,
        embedding: JSON.parse(row.embedding) as number[],
        metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      }))
      .filter((row) => Object.entries(where).every(([key, value]) => row.metadata[key] === value))

    return topKByCosine(
      query,
      candidates.map((item) => ({ item, vector: item.embedding })),
      k,
    ).map(({ item, similarity, distance }) => ({ ...item, similarity, distance }))
  }

  count(collection: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM vector_documents WHERE collection = ?")
      .get(collection) as { count: number }
    return row.count
  }

  close(): void {
    this.db.close()
  }
}
