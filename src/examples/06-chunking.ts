import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { longDocs } from "../data/sample-docs.js"
import { chunkText, fixedChunks, slidingChunk } from "../lib/chunking/fixed.js"
import { splitByHeaders, splitHtmlByHeaders } from "../lib/chunking/structural.js"
import { semanticChunks } from "../lib/chunking/semantic.js"
import { runExample } from "../lib/chroma.js"

/** 청킹 전략 비교. (강의 15, 20, 26, 27) */
await runExample("06 청킹 전략 비교", async () => {
  const body = longDocs[0]?.body ?? ""

  const show = (label: string, chunks: string[]) => {
    const lengths = chunks.map((c) => c.length)
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / (chunks.length || 1))
    console.log(`${label.padEnd(22)} ${String(chunks.length).padStart(3)}개  평균 ${avg}자`)
    console.log(`    첫 청크: ${chunks[0]?.slice(0, 50)}...`)
  }

  show("fixed(300)", fixedChunks(body, 300))
  show("sliding(300/60)", slidingChunk(body, 300, 60))
  show("chunkText(문장경계)", chunkText(body, 300))

  const recursive = new RecursiveCharacterTextSplitter({
    chunkSize: 300,
    chunkOverlap: 30,
    separators: ["\n\n", "\n", ". ", "。", "? ", "! ", " ", ""],
  })
  show("recursive", await recursive.splitText(body))

  console.log("\n--- 의미 기반 (임베딩을 문장마다 만들어서 느리다) ---")
  show("semantic", await semanticChunks(body))

  console.log("\n--- 구조 기반 ---")
  const md = `# 커피\n\n## 에티오피아\n베리향이 두드러진다.\n\n## 콜롬비아\n견과류 향이 있다.\n`
  console.log("markdown 블록:", splitByHeaders(md).map((b) => b.heading))
  const html = `<h1>커피</h1><h2>에티오피아</h2><p>베리향.</p><h2>콜롬비아</h2><p>견과류 향.</p>`
  console.log("html 블록:", splitHtmlByHeaders(html).map((b) => b.heading))
})
