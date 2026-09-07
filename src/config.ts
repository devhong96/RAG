/**
 * 프로젝트 전역 설정.
 *
 * 값을 코드 여기저기에 흩어놓지 않고 한곳에 모은다.
 * 환경변수로 덮어쓸 수 있게 해두면 다른 PC나 강의 환경에서도
 * 코드를 고치지 않고 돌릴 수 있다.
 */
// [자바 노트] application.yml + @ConfigurationProperties 자리다.
//            process.env 는 System.getenv() 와 같다.
//            맨 아래 "as const" 는 이 객체를 통째로 읽기 전용으로 만든다(불변 객체).
export const config = {
  chroma: {
    /** Chroma 서버 주소. `npm run db` 로 띄운 서버의 기본값. */
    url: process.env.CHROMA_URL ?? "http://localhost:8000",
  },
  ollama: {
    /** Ollama 서버 주소. */
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    /** 임베딩 모델. bge-m3 는 1024 차원의 다국어 모델. */
    model: process.env.OLLAMA_MODEL ?? "bge-m3",
    /** 답변 생성용 LLM. */
    chatModel: process.env.OLLAMA_CHAT_MODEL ?? "gemma4:26b",
    /** 응답 없는 로컬 모델 때문에 요청이 무한정 멈추지 않게 하는 상한. */
    timeoutMs: positiveInteger(process.env.OLLAMA_TIMEOUT_MS, 60_000),
  },
  /** 재랭킹용 크로스 인코더. 강의 29 부터 사용. */
  reranker: {
    modelId: process.env.RERANKER_MODEL ?? "Xenova/bge-reranker-base",
    cacheDir: process.env.RERANKER_CACHE ?? "./.transformers-cache",
  },
  /** Express 서버. 강의 22 부터 사용. */
  server: {
    port: positiveInteger(process.env.PORT, 3000),
  },
  /** Neo4j (Graph DB). */
  neo4j: {
    url: process.env.NEO4J_URL ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "password123!",
  },
} as const

/** bge-m3 가 만들어내는 벡터의 차원 수. */
export const EMBEDDING_DIM = 1024

function positiveInteger(value: string | undefined, fallback: number): number {
  // 환경변수는 숫자를 적어도 항상 문자열로 들어온다. Number()로 바꾼 뒤 검증하지 않으면
  // PORT=abc 같은 설정이 NaN이 되어 실제 서버 시작 지점에서 이해하기 어려운 오류가 난다.
  // 학습 예제는 잘못된 선택 설정 때문에 시작조차 못 하는 것보다 안전한 기본값으로 돌아간다.
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
