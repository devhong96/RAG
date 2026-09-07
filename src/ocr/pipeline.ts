import type { Collection } from "chromadb"
import { createHash } from "node:crypto"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { OCREngine } from "./engine.js"
import { chatComplete } from "../lib/llm.js"
import { incrementalUpsert, type IncrementalStats } from "../lib/incremental.js"

export interface DocumentIngestResult {
  rawText: string
  restoredMarkdown: string
  chunks: string[]
  chunkIds: string[]
  /** 증분 적재 결과. 몇 개를 다시 임베딩했고 몇 개를 건너뛰었는지. */
  stats: IncrementalStats
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

  // 3단계: 제목과 문단 경계를 우선하는 재귀적 구조 청킹
  // separators는 앞에 있을수록 우선순위가 높다. 먼저 큰 제목/문단 경계로 나누고,
  // 그래도 chunkSize를 넘을 때만 줄바꿈과 공백처럼 더 작은 경계로 내려간다.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n## ", "\n### ", "\n\n", "\n", " "],
  })
  const chunks = await splitter.splitText(restoredMarkdown)

  // 4단계: Chroma 벡터 적재
  // 정규식으로 영문 외 문자를 '_'로만 바꾸면 "문서가.png"와 "계약서.png"가 비슷한 ID가 된다.
  // 원문 파일명을 해시하면 파일명 노출을 줄이면서도 같은 source에는 항상 같은 ID가 만들어진다.
  const sourceHash = createHash("sha256").update(sourceName).digest("hex").slice(0, 12)
  const baseId = `ocr-${sourceHash}`
  const chunkIds = chunks.map((_, i) => `${baseId}-chunk-${i + 1}`)

  // 일반 문서 인제스트와 동일하게 증분 적재한다.
  // OCR 은 같은 이미지를 다시 돌려도 결과가 미세하게 달라질 수 있어 전부 "변경"으로 잡힐 수
  // 있지만, LLM 복원 결과가 안정적이면 대부분의 청크는 건너뛴다.
  const stats = await incrementalUpsert(
    collection,
    sourceName,
    chunks.map((text, i) => ({
      id: chunkIds[i] as string,
      text,
      metadata: { source: sourceName, chunk_index: i + 1, type: "ocr-document" },
    })),
  )

  return {
    rawText,
    restoredMarkdown,
    chunks,
    chunkIds,
    stats,
  }
}
