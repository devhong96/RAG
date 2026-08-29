import { longDocs } from "../data/sample-docs.js"
import { runExample } from "../lib/chroma.js"
import { ingestDocument } from "../lib/documents.js"
import { answerQuestion, RAG_COLLECTION } from "../lib/rag.js"

/**
 * RAG 전체 흐름: 인제스트 → 검색 → 생성. (강의 23~24)
 * 답변 생성 모델(config.ollama.chatModel)을 먼저 받아둬야 한다.
 * 기본값 확인: src/config.ts — 환경변수 OLLAMA_CHAT_MODEL 로 바꿀 수 있다.
 */
await runExample("[23~24강] RAG 전체 흐름 (인제스트 → 검색 → 생성)", async () => {
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
