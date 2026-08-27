import { longDocs } from "../data/sample-docs.js"
import { runExample } from "../lib/chroma.js"
import { ingestDocument } from "../lib/documents.js"
import { answerQuestion, RAG_COLLECTION } from "../lib/rag.js"

/**
 * RAG 전체 흐름: 인제스트 → 검색 → 생성. (강의 23~24)
 * `ollama pull llama3.2` 가 먼저 필요하다.
 */
await runExample("08 RAG", async () => {
  for (const doc of longDocs) {
    const { chunkCount } = await ingestDocument(RAG_COLLECTION, {
      source: doc.source,
      text: doc.body,
      metadata: { title: doc.title },
    })
    console.log(`인제스트: ${doc.title} → ${chunkCount}개 청크`)
  }

  const question = "에티오피아 원두는 어떤 향이 나나요?"
  console.log(`\n질문: ${question}\n`)

  const { answer, sources } = await answerQuestion(question, 3)
  console.log("답변:", answer)
  console.log("\n근거:")
  sources.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.metadata?.source} (거리 ${s.distance.toFixed(3)})`)
    console.log(`      ${s.document.slice(0, 60)}...`)
  })
})
