import { createWorker, type Worker } from "tesseract.js"
import sharp from "sharp"

export interface OCRResult {
  rawText: string
  confidence: number
}

/**
 * 이미지 전처리 (sharp) 및 한글/영어 OCR (Tesseract.js) 엔진.
 */
export class OCREngine {
  private worker: Worker | null = null

  async init(): Promise<void> {
    if (!this.worker) {
      this.worker = await createWorker(["kor", "eng"])
    }
  }

  /**
   * 이미지 전처리: 그레이스케일, 대비 증폭, 경계선 선명화
   */
  async preprocessImage(input: string | Buffer): Promise<Buffer> {
    return sharp(input)
      .grayscale()
      .normalise()
      .sharpen()
      .toBuffer()
  }

  /** 이미지로부터 텍스트 추출 */
  async recognize(input: string | Buffer): Promise<OCRResult> {
    await this.init()
    if (!this.worker) throw new Error("OCR Worker가 초기화되지 않았습니다.")

    const processedBuffer = await this.preprocessImage(input)
    const result = await this.worker.recognize(processedBuffer)

    return {
      rawText: result.data.text.trim(),
      confidence: result.data.confidence,
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}
