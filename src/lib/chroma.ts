// [자바 노트] { ChromaClient, type Collection } — 한 줄에서 값과 타입을 함께 가져온다.
//            앞의 것은 런타임에 실제로 쓰는 클래스, type 이 붙은 것은 타입 전용이다.
import { ChromaClient, type Collection } from "chromadb"
import { config } from "../config.js"
import { OllamaEmbeddingFunction } from "./ollama-embedding.js"

// chromadb 3.x 는 { path } 를 더 이상 권장하지 않는다. host/port/ssl 로 넘긴다.
const chromaUrl = new URL(config.chroma.url)

/**
 * 예제 전체가 공유하는 클라이언트.
 *
 * [자바 노트] 스프링의 @Bean 싱글턴 자리다. DI 컨테이너가 없으므로
 * 모듈 최상위에 const 로 만들어 두고 다른 파일에서 import 해서 쓴다.
 * 모듈은 최초 import 시 딱 한 번만 평가되므로 이것만으로 싱글턴이 된다.
 */
export const client = new ChromaClient({
  host: chromaUrl.hostname,
  port: Number(chromaUrl.port || (chromaUrl.protocol === "https:" ? 443 : 80)),
  ssl: chromaUrl.protocol === "https:",
})

/** 예제 전체가 공유하는 임베딩 함수. */
export const embedder = new OllamaEmbeddingFunction()

/**
 * 예제용 컬렉션을 항상 빈 상태에서 시작하고 싶을 때 쓴다.
 * 없는 컬렉션을 지우면 404 가 나므로 삼켜준다.
 *
 * [자바 노트] .catch(() => {}) 는 try/catch 로 예외를 무시하는 것과 같다.
 *            () => {} 는 자바의 람다 () -> {} 와 같은 문법이다.
 */
export async function resetCollection(name: string): Promise<Collection> {
  await client.deleteCollection({ name }).catch(() => {})
  return client.getOrCreateCollection({ name, embeddingFunction: embedder })
}

/**
 * 이미 있으면 그대로 쓰고 없으면 만든다.
 * 영속성 확인처럼 이전 실행 결과를 이어받아야 할 때 쓴다.
 */
export async function openCollection(name: string): Promise<Collection> {
  return client.getOrCreateCollection({ name, embeddingFunction: embedder })
}

/**
 * 예제를 실행하는 공통 래퍼.
 *
 * 예제마다 try/catch 를 반복하지 않으려고 여기로 모았다.
 * 실패하면 스택트레이스 대신 읽을 수 있는 한 줄을 보여주고 종료한다.
 *
 * [자바 노트] fn: () => Promise<void> 는 "인자 없고 Promise 를 반환하는 함수"라는 뜻.
 *            자바의 Supplier<CompletableFuture<Void>> 를 파라미터로 받는 것과 같다.
 *            TS 에서는 함수를 값처럼 주고받는 게 매우 흔하다.
 */
export async function runExample(title: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n=== ${title} ===\n`)
  try {
    await fn()
  } catch (error) {
    // [자바 노트] catch 파라미터의 타입은 unknown 이다. 자바처럼 catch (IOException e) 로
    //            타입을 좁힐 수 없어서, 직접 instanceof 로 확인해야 한다.
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n[실패] ${message}`)
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      console.error(`Chroma 서버가 떠 있는지 확인하세요: npm run db`)
    }
    // [자바 노트] System.exit(1) 대신 종료 코드만 예약한다. 남은 작업은 끝까지 돌고 종료된다.
    process.exitCode = 1
  }
}
