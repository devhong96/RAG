import { embedder, runExample } from "../lib/chroma.js"
import { SqliteVectorStore } from "../sqlite/vector-store.js"

const DOCUMENTS = [
  { id: "coffee-1", text: "에티오피아 원두는 꽃향과 밝은 산미가 특징이다.", category: "coffee" },
  { id: "coffee-2", text: "브라질 원두는 견과류 풍미와 묵직한 단맛이 난다.", category: "coffee" },
  { id: "animal-1", text: "고양이는 하루 대부분을 잠으로 보낸다.", category: "animal" },
]

await runExample("SQLite 의미 검색 (Flat 기준 구현)", async () => {
  const store = new SqliteVectorStore("./data/sqlite-vector-demo.db")
  try {
    const vectors = await embedder.generate(DOCUMENTS.map((document) => document.text))
    store.upsert("demo", DOCUMENTS.map((document, i) => ({
      id: document.id,
      text: document.text,
      embedding: vectors[i] as number[],
      metadata: { category: document.category },
    })))

    const [queryVector] = await embedder.generate(["신맛이 선명한 커피를 알려줘"])
    const hits = store.search("demo", queryVector as number[], 2, { category: "coffee" })
    console.table(hits.map((hit) => ({
      id: hit.id,
      similarity: hit.similarity.toFixed(3),
      text: hit.text,
    })))
  } finally {
    store.close()
  }
})
