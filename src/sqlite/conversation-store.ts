import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { ChatMessage } from "../lib/llm.js"
import { MAX_TURNS, type ConversationStorePort } from "../lib/conversation.js"

/** 프로세스를 재시작해도 남는 SQLite 기반 장기 대화 기억. */
export class SqliteConversationStore implements ConversationStorePort {
  private readonly db: DatabaseSync

  constructor(path: string, private readonly maxTurns = MAX_TURNS) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS conversation_messages (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_session_sequence
        ON conversation_messages(session_id, sequence DESC);
    `)
  }

  get(sessionId: string): ChatMessage[] {
    const rows = this.db.prepare(`
      SELECT role, content FROM conversation_messages
      WHERE session_id = ? ORDER BY sequence DESC LIMIT ?
    `).all(sessionId, this.maxTurns * 2) as { role: "user" | "assistant"; content: string }[]
    return rows.reverse()
  }

  append(sessionId: string, question: string, answer: string): void {
    const insert = this.db.prepare(
      "INSERT INTO conversation_messages(session_id, role, content) VALUES (?, ?, ?)",
    )
    this.db.exec("BEGIN")
    try {
      insert.run(sessionId, "user", question)
      insert.run(sessionId, "assistant", answer)
      this.db.prepare(`
        DELETE FROM conversation_messages
        WHERE session_id = ? AND sequence NOT IN (
          SELECT sequence FROM conversation_messages
          WHERE session_id = ? ORDER BY sequence DESC LIMIT ?
        )
      `).run(sessionId, sessionId, this.maxTurns * 2)
      this.db.exec("COMMIT")
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  clear(sessionId: string): void {
    this.db.prepare("DELETE FROM conversation_messages WHERE session_id = ?").run(sessionId)
  }

  get size(): number {
    const row = this.db.prepare(
      "SELECT COUNT(DISTINCT session_id) AS count FROM conversation_messages",
    ).get() as { count: number }
    return row.count
  }

  close(): void {
    this.db.close()
  }
}
