import fs from "node:fs/promises"
import path from "node:path"
import { resetCollection, runExample } from "../lib/chroma.js"
import { formatStats } from "../lib/incremental.js"
import { ingestDocumentImageToVectorDB } from "./pipeline.js"
import { generateSampleDocImage } from "./sample-doc.js"
import { chatComplete, type ChatMessage } from "../lib/llm.js"

/**
 * [OCR 스크립트 2: OCR 복원 문서 벡터 적재 및 질의응답 (Search)]
 *
 * 1. 복원된 문서를 재귀적 구조 청킹하여 Chroma 벡터 DB에 적재합니다.
 * 2. 질문에 대한 관련 청크를 검색하고, LLM을 통해 정확한 답변을 생성합니다.
 */

await runExample("OCR 정제 문서 벡터 DB 적재 및 질의응답 (Search)", async () => {
  const sampleImagePath = path.resolve("./sample-doc-scan.png")

  // 이미지가 없으면 자동 생성
  try {
    await fs.access(sampleImagePath)
  } catch {
    await generateSampleDocImage(sampleImagePath)
  }

  console.log("\n[1] Chroma 벡터 DB 초기화 및 문서 인제스트...")
  const collection = await resetCollection("ocr-documents-demo")

  const result = await ingestDocumentImageToVectorDB(collection, sampleImagePath, {
    sourceName: "AI_서버_규격서_2026.png",
    chunkSize: 600,
    chunkOverlap: 80,
  })

  // 이 데모는 매번 컬렉션을 비우고 시작하므로 항상 "변경"으로 찍힌다.
  // resetCollection 을 openCollection 으로 바꿔 두 번 돌리면 "건너뜀"이 늘어나는 것을 볼 수 있다.
  console.log(`✅ Chroma에 ${result.chunks.length}개 청크 적재 완료 (${formatStats(result.stats)})`)
  result.chunks.forEach((c, idx) => {
    console.log(`  [청크 ${idx + 1}] (ID: ${result.chunkIds[idx]})`)
  })

  // 2. 질문 검색
  const question = process.argv[2] ?? "2026년 3분기 이후 신규 데이터센터 입고 서버의 냉각 방식 규정과 GPU VRAM 총 용량은 얼마인가요?"

  console.log("\n==================================================")
  console.log(`[사용자 질문]\n"${question}"`)
  console.log("==================================================")

  console.log("\n[2] Chroma 유사도 검색 실행 (Top 2)...")
  const searchRes = await collection.query({
    queryTexts: [question],
    nResults: 2,
  })

  const hits = searchRes.documents?.[0] ?? []
  hits.forEach((doc, idx) => {
    console.log(`\n[검색된 문서 청크 ${idx + 1}]\n${doc}`)
  })

  // 3. LLM 답변 생성
  console.log("\n[3] LLM 답변 생성 중...")
  const promptMessages: ChatMessage[] = [
    {
      role: "system",
      content: `당신은 사내 문서를 바탕으로 질문에 정확하게 답변하는 엔터프라이즈 AI입니다.
제공된 [참고자료]의 내용만을 근거로 구체적인 수치와 명칭을 포함하여 답변하세요.`,
    },
    {
      role: "user",
      content: `[참고자료]\n${hits.join("\n\n")}\n\n[질문]\n${question}`,
    },
  ]

  const answer = await chatComplete(promptMessages)

  console.log("\n==================================================")
  console.log("【 최종 RAG 생성 답변 】")
  console.log("==================================================")
  console.log(answer)
})
