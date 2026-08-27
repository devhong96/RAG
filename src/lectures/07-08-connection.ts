import { client, embedder, runExample } from "../lib/chroma.js"
import { config } from "../config.js"

await runExample("[07~08강] Chroma/Ollama 연결 점검", async () => {
  const heartbeat = await client.heartbeat()
  console.log(`Chroma  ${config.chroma.url}  OK  (heartbeat=${heartbeat})`)

  const vectors = await embedder.generate(["연결 테스트"])
  console.log(`Ollama  ${config.ollama.url}  OK  (모델=${config.ollama.model}, 차원=${vectors[0]?.length})`)

  const collections = await client.listCollections()
  console.log(`\n현재 컬렉션 ${collections.length}개:`, collections.map((c) => c.name))
})
