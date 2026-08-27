import { EMBEDDING_DIM } from "../config.js"
import { resetCollection, runExample } from "../lib/chroma.js"

/**
 * 임베딩 함수가 "언제" 호출되는지 확인하는 예제.
 *
 *   documents / queryTexts      → 임베딩 함수가 자동 호출됨
 *   embeddings / queryEmbeddings → 임베딩 함수는 호출되지 않음
 */
await runExample("[10강] 임베딩 함수 호출 시점 확인", async () => {
  const collection = await resetCollection("embedding-timing")

  await collection.upsert({
    ids: ["auto"],
    documents: ["임베딩 함수가 호출되어 벡터가 만들어진다."],
  })

  const dummy = Array.from({ length: EMBEDDING_DIM }, () => 0)
  await collection.upsert({
    ids: ["manual"],
    documents: ["벡터는 내가 직접 만들었다."],
    embeddings: [dummy],
  })

  const result = await collection.get({
    ids: ["auto", "manual"],
    include: ["embeddings"] as const,
  })

  console.log("auto   (documents 만 전달) :", result.embeddings?.[0]?.slice(0, 5))
  console.log("manual (embeddings 직접 전달) :", result.embeddings?.[1]?.slice(0, 5))
  console.log("\nmanual 쪽이 0 벡터인 것은 임베딩 함수가 호출되지 않았다는 뜻이다.")
})
