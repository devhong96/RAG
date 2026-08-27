import type { Collection } from "chromadb"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { OCREngine } from "./engine.js"
import { chatComplete } from "../lib/llm.js"

export interface DocumentIngestResult {
  rawText: string
  restoredMarkdown: string
  chunks: string[]
  chunkIds: string[]
}

export interface DocumentIngestOptions {
  sourceName?: string
  chunkSize?: number
  chunkOverlap?: number
}

/**
 * LLM을 사용해 OCR 원본의 오탈자를 보정하고 마크다운/표 형태로 구조화
 */
export async function structureOCRWithLLM(rawOcrText: string): Promise<string> {
  try {
    const prompt = `당신은 문서 OCR 및 테크니컬 문서 정제 전문가 AI입니다.
입력된 내용은 스캔된 문서에서 OCR(광학 문자 인식)로 추출한 원본 텍스트입니다.
아래 지침에 따라 문서를 완벽하고 깔끔한 마크다운(Markdown) 문서로 정제하세요.

[지침]
1. OCR 인식 오류로 깨지거나 왜곡된 단어(오탈자, 특수문자 깨짐)를 문맥에 맞게 자연스럽게 보정하세요.
2. 표(Table) 형태나 목록 형태의 데이터는 반드시 마크다운 표(| 컬럼1 | 컬럼2 |) 또는 구조화된 불릿 리스트로 재구성하세요.
3. 문서에 없는 내용을 임의로 지어내거나 왜곡하지 마세요 (할루시네이션 금지).
4. 부가적인 설명, 인사말, 코드블록 백틱(\`\`\`) 없이 오직 정제된 마크다운 본문 텍스트만 출력하세요.`

    const restored = await chatComplete([
      { role: "system", content: prompt },
      { role: "user", content: rawOcrText },
    ])

    return restored.trim()
  } catch (error) {
    console.warn("LLM 후처리 실패, 기본 텍스트 정제기 사용:", error)
    return rawOcrText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }
}

/**
 * 이미지/스캔 문서 -> OCR -> LLM 마크다운 복원 -> 청킹 -> ChromaDB 적재 파이프라인
 */
export async function ingestDocumentImageToVectorDB(
  collection: Collection,
  imageSource: string | Buffer,
  options: DocumentIngestOptions = {},
): Promise<DocumentIngestResult> {
  const {
    sourceName = "scanned-doc.png",
    chunkSize = 600,
    chunkOverlap = 80,
  } = options

  // 1단계: OCR 텍스트 추출
  const ocr = new OCREngine()
  let rawText = ""
  try {
    const ocrRes = await ocr.recognize(imageSource)
    rawText = ocrRes.rawText
  } finally {
    await ocr.terminate()
  }

  // 2단계: LLM 마크다운/표 복원
  const restoredMarkdown = await structureOCRWithLLM(rawText)

  // 3단계: 구조 보존 시맨틱 청킹
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n## ", "\n### ", "\n\n", "\n", " "],
  })
  const chunks = await splitter.splitText(restoredMarkdown)

  // 4단계: Chroma 벡터 적재
  const baseId = sourceName.replace(/[^a-zA-Z0-9_-]/g, "_")
  const chunkIds = chunks.map((_, i) => `${baseId}-chunk-${i + 1}`)
  const metadatas = chunks.map((_, i) => ({
    source: sourceName,
    chunk_index: i + 1,
    type: "ocr-document",
  }))

  await collection.upsert({
    ids: chunkIds,
    documents: chunks,
    metadatas,
  })

  return {
    rawText,
    restoredMarkdown,
    chunks,
    chunkIds,
  }
}
