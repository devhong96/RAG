import { config } from "../config.js"

/**
 * [자바 노트] "type" 은 interface 와 비슷하지만 유니온 같은 것도 표현할 수 있다.
 * role 의 타입이 "system" | "user" | "assistant" 인데, 이건 세 문자열만 허용한다는 뜻이다.
 * 자바의 enum 자리를 이런 리터럴 유니온이 대신한다.
 */
export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Ollama 채팅 API 로 답변을 생성한다. (강의 23~)
 * 임베딩과 같은 서버를 쓰지만 모델과 엔드포인트가 다르다.
 */
export interface ChatOptions {
  /** 0 이면 거의 결정적. RAG 처럼 자료를 그대로 옮겨야 하는 작업에는 낮게 둔다. */
  temperature?: number
  /** 호출별 제한 시간. 생략하면 전역 OLLAMA_TIMEOUT_MS를 사용한다. */
  timeoutMs?: number
  /**
   * 출력 형식을 문법으로 강제한다. (패턴 2 - 문법)
   *
   * "json" 을 주면 올바른 JSON 임을 보장하고, JSON 스키마 객체를 주면
   * 필드 이름과 타입까지 맞춘 JSON 만 나오게 한다.
   *
   * [초보자 설명] 프롬프트로 "JSON만 출력하세요"라고 부탁하는 것과는 급이 다르다.
   * 부탁은 모델이 어길 수 있지만(설명을 덧붙이거나 ```json 펜스를 씌운다),
   * 이건 토큰을 고르는 단계에서 형식에 안 맞는 후보를 아예 제외해 버린다.
   * 그래서 "지켜주길 바라는" 게 아니라 "지킬 수밖에 없는" 출력이 된다.
   */
  format?: "json" | Record<string, unknown>
}

export async function chatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  let response: Response
  try {
    // fetch 자체에는 기본 제한 시간이 없다. 서버가 연결만 받아놓고 응답하지 않으면
    // await가 계속 남으므로 AbortSignal로 클라이언트 쪽 대기 시간을 제한한다.
    // 주의: 요청 취소는 "기다리기를 그만둔다"는 뜻이며, 서버의 모델 연산까지
    // 반드시 즉시 중단된다는 보장은 없다.
    response = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? config.ollama.timeoutMs),
      body: JSON.stringify({
        model: config.ollama.chatModel,
        messages,
        stream: false,
        // format 을 주지 않으면 키 자체를 빼야 한다. null 을 보내면 거부하는 버전이 있다.
        ...(options.format ? { format: options.format } : {}),
        options: { temperature: options.temperature ?? 0 },
      }),
    })
  } catch (cause) {
    // 시간 초과와 연결 실패를 나눠야 사용자가 모델이 느린지, 서버가 꺼졌는지 구분할 수 있다.
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new Error(
        `Ollama 응답 제한 시간을 초과했습니다 (${options.timeoutMs ?? config.ollama.timeoutMs}ms).`,
        { cause },
      )
    }
    throw new Error(
      `Ollama 에 연결할 수 없습니다 (${config.ollama.url}). \`ollama serve\` 확인.`,
      { cause },
    )
  }

  if (response.status === 404) {
    throw new Error(
      `모델 '${config.ollama.chatModel}' 없음. \`ollama pull ${config.ollama.chatModel}\` 먼저 실행하세요.`,
    )
  }
  if (!response.ok) {
    throw new Error(`LLM 요청 실패 (${response.status}): ${await response.text().catch(() => "")}`)
  }

  const data = (await response.json()) as { message?: { content?: string } }
  return data.message?.content ?? ""
}
