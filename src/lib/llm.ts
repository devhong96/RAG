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
}

export async function chatComplete(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${config.ollama.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.chatModel,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0 },
      }),
    })
  } catch (cause) {
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
