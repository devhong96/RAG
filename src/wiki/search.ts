import { openCollection, runExample } from "../lib/chroma.js"
import { chatComplete, type ChatMessage } from "../lib/llm.js"
import { WIKI_COLLECTION } from "./pipeline.js"

/**
 * [위키 스크립트 2] 적재된 위키 청크로 질문에 답한다. (검색 → 근거 조립 → 생성)
 *
 *   npm run wiki:search                                   # 기본 예시 질문
 *   npm run wiki:search -- "워드 임베딩은 무엇인가요?"
 *
 * 먼저 `npm run wiki:ingest` 를 실행해 두어야 한다.
 */
const DEFAULT_QUESTION = "트랜스포머의 셀프 어텐션은 무엇이고 어떤 문제를 해결했나요?"

await runExample("위키백과 RAG 질의응답", async () => {
  const question = process.argv.slice(2).join(" ").trim() || DEFAULT_QUESTION
  const collection = await openCollection(WIKI_COLLECTION)

  if ((await collection.count()) === 0) {
    console.log("컬렉션이 비어 있습니다. 먼저 `npm run wiki:ingest` 를 실행하세요.")
    return
  }

  console.log(`[질문] ${question}\n`)
  console.log("[1] 유사도 검색 (Top 4)")
  const result = await collection.query({ queryTexts: [question], nResults: 4 })

  const documents = result.documents?.[0] ?? []
  const distances = result.distances?.[0] ?? []
  const metadatas = result.metadatas?.[0] ?? []

  if (documents.length === 0) {
    console.log("검색 결과가 없습니다.")
    return
  }

  // 검색 결과를 LLM 이 읽기 좋은 형태로 만든다. 출처를 함께 넣어 근거를 밝히게 한다.
  const context = documents
    .map((doc, i) => {
      const meta = (metadatas[i] ?? {}) as { title?: string; heading?: string; source?: string }
      const distance = distances[i]
      console.log(
        `  [${i + 1}] ${meta.title ?? "?"} > ${meta.heading ?? "?"}` +
          ` (거리 ${distance?.toFixed(3) ?? "-"})`,
      )
      // 출처 주소까지 같이 보여줘야 답변을 사람이 원문과 대조해 검증할 수 있다.
      if (meta.source) console.log(`      ${meta.source}`)
      return `[자료 ${i + 1} - ${meta.title ?? "?"} / ${meta.heading ?? "?"}]\n${doc ?? ""}`
    })
    .join("\n\n")

  console.log("\n[2] LLM 답변 생성 중...")
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 위키백과 발췌문을 근거로 한국어로 답하는 도우미입니다.
1. 반드시 제공된 [자료] 안의 내용만 사용하고, 숫자와 고유명사는 적힌 그대로 인용하세요.
2. 자료에 근거가 없으면 "제공된 자료로는 답할 수 없습니다"라고만 답하세요.
3. 세 문장 이내로 핵심만 정리하고, 마지막 줄에 참고한 자료 번호를 (자료 1, 3) 형식으로 적으세요.`,
    },
    {
      role: "user",
      content: `[자료]\n${context}\n\n[질문]\n${question}`,
    },
  ]

  const answer = await chatComplete(messages)
  console.log("\n=== 답변 ===")
  console.log(answer)
})
