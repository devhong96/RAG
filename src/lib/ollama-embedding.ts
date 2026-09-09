// [자바 노트] import 경로가 ".js" 인데 실제 파일은 .ts 다. 오타가 아니라 ESM 규칙이다.
//            자세한 내용은 docs/05-reference/자바개발자를-위한-노트.md 1번 참고.
// [자바 노트] "import type" 은 타입만 가져온다. 컴파일하면 이 줄은 사라진다.
import type { EmbeddingFunction, EmbeddingFunctionSpace } from "chromadb"
import { config } from "../config.js"

/**
 * [자바 노트] interface 는 자바와 비슷하지만 "필드만 있는 DTO"로도 자주 쓴다.
 * "?" 가 붙으면 선택 항목이라는 뜻이다 (Optional<String> 같은 느낌).
 */
export interface OllamaEmbeddingOptions {
  url?: string
  model?: string
  timeoutMs?: number
}

/**
 * Ollama 를 임베딩 백엔드로 쓰는 EmbeddingFunction.
 *
 * [자바 노트] TS 는 타입이 "구조적"이라, 모양만 맞으면 implements 없이도 통과한다.
 * 그래서 예전 코드는 인터페이스와 어긋났는데도 아무도 못 잡았다.
 * implements 를 일부러 붙여두면 자바처럼 컴파일 타임에 검사해준다.
 */
export class OllamaEmbeddingFunction implements EmbeddingFunction {
  /**
   * chromadb 인터페이스상 `name` 은 메서드가 아니라 문자열 프로퍼티다.
   * [자바 노트] readonly = 자바의 final. 생성자에서만 값을 넣을 수 있다.
   */
  readonly name: string

  // [자바 노트] private 은 자바와 같은 의미다. 단, 런타임에는 강제되지 않는다
  //            (타입 검사 단계에서만 막아준다).
  private readonly url: string
  private readonly model: string
  private readonly timeoutMs: number

  // [자바 노트] 자바의 오버로딩 대신 "옵션 객체 + 기본값" 패턴을 쓴다.
  //            = {} 는 인자를 아예 안 넘겨도 되게 하는 기본값이다.
  constructor(options: OllamaEmbeddingOptions = {}) {
    // [자바 노트] ?? 는 왼쪽이 null/undefined 일 때만 오른쪽을 쓴다.
    //            자바의 Optional.ofNullable(x).orElse(y) 와 같다.
    this.url = options.url ?? config.ollama.url
    this.model = options.model ?? config.ollama.model
    this.timeoutMs = options.timeoutMs ?? config.ollama.timeoutMs
    // [자바 노트] 백틱 문자열은 자바 15+ 의 텍스트 블록 + String.format 을 합친 것.
    this.name = `ollama-${this.model}`
  }

  /** bge-m3 같은 임베딩 모델은 코사인 거리를 쓰는 게 일반적이다. */
  defaultSpace(): EmbeddingFunctionSpace {
    return "cosine"
  }

  supportedSpaces(): EmbeddingFunctionSpace[] {
    // [자바 노트] 반환 타입이 문자열 배열인데 아무 문자열이나 되는 건 아니다.
    //            EmbeddingFunctionSpace 는 "cosine" | "l2" | "ip" 같은 유니온 타입으로,
    //            자바의 enum 자리를 대신한다.
    return ["cosine", "l2", "ip"]
  }

  /**
   * 텍스트 배열을 벡터 배열로 변환한다.
   * Chroma 가 `documents` / `queryTexts` 를 받을 때 내부적으로 호출한다.
   *
   * [자바 노트] async 를 붙이면 반환 타입이 Promise 로 감싸진다.
   *            Promise<T> ≒ CompletableFuture<T>, await ≒ future.get().
   *            단, Node 는 싱글 스레드라 await 가 스레드를 블로킹하지 않는다.
   */
  async generate(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    // [자바 노트] let 은 재할당 가능한 변수, const 는 final 변수다. 기본은 const.
    let response: Response
    try {
      // [자바 노트] fetch 는 Node 에 내장된 HTTP 클라이언트다 (HttpClient 자리).
      //            별도 라이브러리를 깔 필요가 없다.
      // 채팅 호출과 마찬가지로 fetch에는 기본 timeout이 없어서 명시적으로 취소 신호를 준다.
      response = await fetch(`${this.url}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        // [자바 노트] JSON.stringify = 잭슨의 writeValueAsString.
        body: JSON.stringify({ model: this.model, input: texts }),
      })
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new Error(
          `Ollama 임베딩 응답 제한 시간을 초과했습니다 (${this.timeoutMs}ms).`,
          { cause },
        )
      }
      // fetch 자체가 실패 = 서버가 안 떠 있는 경우가 대부분이다.
      // [자바 노트] { cause } 는 자바의 new Exception(msg, cause) 와 같다.
      //            참고로 TS 에는 checked exception 이 없어서 throws 선언이 없다.
      throw new Error(
        `Ollama 에 연결할 수 없습니다 (${this.url}). \`ollama serve\` 가 실행 중인지 확인하세요.`,
        { cause },
      )
    }

    // [자바 노트] fetch 는 4xx/5xx 여도 예외를 던지지 않는다. 직접 확인해야 한다.
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      if (response.status === 404) {
        throw new Error(
          `모델 '${this.model}' 을 찾을 수 없습니다. \`ollama pull ${this.model}\` 로 먼저 받으세요.`,
        )
      }
      throw new Error(`Ollama 요청 실패 (${response.status}): ${body}`)
    }

    // [자바 노트] as 는 캐스팅처럼 보이지만 런타임 검사를 하지 않는다.
    //            ClassCastException 이 없는 대신, 틀리면 조용히 통과한다.
    //            그래서 바로 아래에서 직접 검증한다.
    const data = (await response.json()) as { embeddings?: number[][] }
    if (!data.embeddings || data.embeddings.length !== texts.length) {
      // [자바 노트] ?. 는 앞이 null 이면 통째로 undefined 를 돌려준다 (NPE 안 남).
      throw new Error(
        `Ollama 응답이 예상과 다릅니다. 입력 ${texts.length}개, 응답 ${data.embeddings?.length ?? 0}개`,
      )
    }
    return data.embeddings
  }
}
