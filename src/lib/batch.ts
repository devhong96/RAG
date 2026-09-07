/**
 * 배치 처리 — 한 번에 얼마나 보낼지 정한다. (패턴 8: 대규모 색인화)
 *
 * [초보자 설명] 임베딩 요청은 이미 배열을 통째로 보내고 있다.
 * `OllamaEmbeddingFunction.generate(texts)` 가 텍스트 100개를 받으면 HTTP 요청은 한 번이다.
 * 그래서 "배치가 없다"는 문제는 이 저장소에 없었다. 진짜 문제는 **상한이 없다**는 것이다.
 *
 * 청크가 3,000개인 문서를 인제스트하면 요청 하나에 텍스트 3,000개가 실려 나간다.
 * 그때 이런 일이 생긴다.
 *   - 제한 시간(기본 60초) 안에 못 끝내고 통째로 실패한다. 2,999개를 처리했어도 전부 버려진다
 *   - 요청 본문이 커져 메모리를 밀어올린다
 *   - 진행 상황을 알 수 없다. 60초 동안 화면이 멈춰 있어 죽은 건지 도는 건지 모른다
 *
 * 나눠 보내면 셋 다 완화된다. 실패해도 그 배치만 잃고, 메모리는 배치 크기로 묶이고,
 * 배치마다 진행률을 찍을 수 있다.
 *
 * **대신 배치를 너무 잘게 나누면 손해다.** 요청마다 왕복 시간이 붙기 때문에,
 * 크기 1로 나누면 청크 수만큼 왕복이 생겨 훨씬 느려진다.
 * 즉 배치 크기는 "실패 단위를 얼마나 작게 할 것인가"와 "왕복을 얼마나 줄일 것인가"를
 * 맞바꾸는 다이얼이다. 정답은 없고 모델과 문서 길이에 따라 달라진다.
 *
 * [자바 노트] 스프링 배치의 chunk size 와 같은 개념이다. 커밋 단위를 정하는 것.
 */

/** 기본 배치 크기. 로컬 Ollama + bge-m3 기준으로 무난한 값이며, 근거는 경험적이다. */
export const DEFAULT_BATCH_SIZE = 64

/**
 * 배열을 정해진 크기로 자른다.
 *
 * [자바 노트] 구아바의 Lists.partition 과 같다.
 */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error("배치 크기는 1 이상이어야 합니다")
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export interface BatchProgress {
  /** 지금까지 처리를 끝낸 항목 수. */
  done: number
  /** 전체 항목 수. */
  total: number
  /** 몇 번째 배치인가 (1부터). */
  batch: number
  batchCount: number
}

export interface BatchOptions {
  size?: number
  onProgress?: (progress: BatchProgress) => void
}

/**
 * 배열을 배치로 나눠 순차 처리한다.
 *
 * 병렬로 돌리지 않는 이유: 임베딩 상대가 로컬 Ollama 한 대다.
 * 동시에 던져도 결국 같은 GPU 를 순서대로 쓰므로 빨라지지 않고, 메모리만 함께 튄다.
 * 원격 API 처럼 동시 요청이 실제로 병렬 처리되는 상대라면 이 부분을 동시성 제한이 있는
 * 병렬 실행으로 바꾸는 게 맞다. 이 저장소의 전제(로컬 실행)에 맞춰 단순하게 둔다.
 */
export async function processInBatches<T>(
  items: readonly T[],
  handler: (batch: T[]) => Promise<void>,
  options: BatchOptions = {},
): Promise<void> {
  const size = options.size ?? DEFAULT_BATCH_SIZE
  const batches = chunkArray(items, size)
  let done = 0

  for (const [index, batch] of batches.entries()) {
    await handler(batch)
    done += batch.length
    options.onProgress?.({
      done,
      total: items.length,
      batch: index + 1,
      batchCount: batches.length,
    })
  }
}

/** 진행률을 한 줄로 만든다. 스크립트 로그에 쓴다. */
export function formatProgress(p: BatchProgress): string {
  const percent = p.total === 0 ? 100 : Math.round((p.done / p.total) * 100)
  return `배치 ${p.batch}/${p.batchCount} — ${p.done}/${p.total} (${percent}%)`
}
