import fs from "node:fs/promises"
import path from "node:path"
import { runExample } from "../lib/chroma.js"
import { OCREngine } from "./engine.js"
import { structureOCRWithLLM } from "./pipeline.js"
import { generateSampleDocImage } from "./sample-doc.js"
import { config } from "../config.js"

/**
 * [OCR 스크립트 1: 이미지 문자 추출 및 LLM 마크다운 복원 (Parse)]
 *
 * 1. 스캔된 이미지 문서를 sharp로 전처리한 후 Tesseract로 텍스트를 추출합니다.
 * 2. 원시 OCR 텍스트(오탈자/깨짐 포함)를 LLM에 전달해 구조화된 마크다운 문서로 복원합니다.
 * 3. 복원 결과를 파일(scanned-doc-restored.md)로 저장합니다.
 */

await runExample("OCR 문자 추출 및 LLM 마크다운/표 복원 (Parse)", async () => {
  const targetImage = process.argv[2] ?? (await generateSampleDocImage("./sample-doc-scan.png"))
  const resolvedPath = path.resolve(targetImage)

  console.log(`\n[1] 대상 이미지 문서 처리: ${resolvedPath}`)

  const ocr = new OCREngine()
  let rawText = ""

  try {
    console.log("[2] sharp 전처리 및 Tesseract 한/영 OCR 실행 중...")
    const result = await ocr.recognize(resolvedPath)
    rawText = result.rawText

    console.log("\n==================================================")
    console.log("【 1. 원시 OCR (Raw OCR) 추출 결과 】")
    console.log("==================================================")
    console.log(rawText)

    // 모델 이름을 문자열로 박아두면 설정을 바꿨을 때 화면 안내와 실제 동작이 어긋난다.
    // config 에서 읽어 실제로 쓰는 모델을 그대로 보여준다.
    console.log(`\n[3] LLM(${config.ollama.chatModel})을 통한 오탈자 보정 및 마크다운/표 구조 복원 중...`)
    const restoredMarkdown = await structureOCRWithLLM(rawText)

    console.log("\n==================================================")
    console.log("【 2. LLM 복원 완료 마크다운 (Clean Markdown) 】")
    console.log("==================================================")
    console.log(restoredMarkdown)

    const outputPath = path.resolve("./scanned-doc-restored.md")
    await fs.writeFile(outputPath, restoredMarkdown, "utf-8")
    console.log(`\n💾 복원된 마크다운 파일이 저장되었습니다: ${outputPath}`)
    console.log("\n다음 단계로 벡터 DB 적재 및 질의응답을 진행해 보세요:")
    console.log("   👉 npm run ocr:search")
  } finally {
    await ocr.terminate()
  }
})
