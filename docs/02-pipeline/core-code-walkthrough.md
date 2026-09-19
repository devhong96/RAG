# 핵심 파이프라인 코드 읽기 (자바 개발자용)

청킹 → 임베딩 → 저장 → 검색 → 생성. 이 한 줄을 구성하는 파일 7개를 **데이터가 흐르는 순서대로**, 자바 개발자 눈에 걸리는 문법 위주로 푼다. 개념 설명은 [RAG 상세 파이프라인](rag-pipeline.md)에, 일반적인 언어 차이는 [자바 개발자를 위한 노트](../05-reference/자바개발자를-위한-노트.md)에 있으니 여기서는 **"이 줄이 무슨 문법이고 자바로는 뭔가"**만 다룬다.

처음부터 끝까지 읽는 문서가 아니다. **코드 파일을 열어 두고 막히는 절만 찾아 대조**한다. 문법이 반복되므로 4절(`documents.ts`)까지 읽으면 나머지는 빠르게 넘어간다.

## 목차

| 절 | 파일 | 역할 | 새로 나오는 문법 |
|:---:|---|---|---|
| [0](#0-임베딩은-어디서-일어나나-먼저-풀어야-할-오해) | — | 임베딩이 어디서 일어나나 | — |
| [1](#1-chunkingfixedts--chunktext) | `chunking/fixed.ts` | 문서를 자른다 | 기본값 파라미터, 내부 함수, `for...of` |
| [2](#2-ollama-embeddingts--텍스트--벡터) | `ollama-embedding.ts` | 텍스트 → 벡터 | `readonly`, `??`, `fetch`, `catch`, `as` |
| [3](#3-chromats--싱글턴) | `chroma.ts` | 클라이언트·임베딩 함수 싱글턴 | 모듈 싱글턴, `{ name }` 축약, 함수 타입 |
| [4](#4-documentsts--ingest--search) | `documents.ts` | ingest / search | Promise 캐시, 제네릭, `?.`, `=> ({})`, 스프레드 |
| [5](#5-incrementalts--바뀐-청크만-upsert) | `incremental.ts` | 바뀐 청크만 upsert | `[KEY]: value`, `typeof`, `async` 람다 |
| [6](#6-llmts--채팅-호출) | `llm.ts` | 채팅 호출 | 리터럴 유니온 |
| [7](#7-ragts--검색--컨텍스트--생성) | `rag.ts` | 검색 → 컨텍스트 → 생성 | 객체 리터럴로 인터페이스 구현, `as const`, 배열 스프레드 |
| [8](#8-반복되는-문법-치트시트) | — | 문법 치트시트 | 전체 요약표 |
| [9](#9-확인-질문) | — | 확인 질문 | — |

## 0. 임베딩은 어디서 일어나나 (먼저 풀어야 할 오해)

`ingestDocument` 를 읽으면 청킹은 보이는데 임베딩 호출이 안 보인다. **우리 코드에는 임베딩을 부르는 줄이 없다. Chroma 가 대신 부른다.**

```text
chroma.ts:24        embedder = new OllamaEmbeddingFunction()             임베딩 함수 객체 생성
documents.ts:38     getOrCreateCollection({ embeddingFunction: embedder })  컬렉션에 등록
incremental.ts:174  collection.upsert({ documents: [텍스트...] })          텍스트만 넘김
                        ↓ chromadb 라이브러리 내부
ollama-embedding.ts:69  embedder.generate(texts)                          Chroma 가 알아서 호출
                        ↓
                    벡터 + 텍스트 + 메타데이터를 Chroma 서버에 저장
```

컬렉션을 만들 때 "텍스트 들어오면 이 함수로 벡터 만들어라" 하고 **콜백을 등록**해 두면, 이후 `upsert` 에 텍스트만 넘겨도 Chroma 가 등록된 함수를 불러 임베딩한다. 검색도 같다. `query({ queryTexts: [질문] })` 에 문장만 넘기면 같은 `embedder` 로 질문을 벡터화해 비교한다.

자바로 치면 JPA 엔티티에 `@Convert(converter = ...)` 를 붙여 두면 `save()` 할 때 자동 변환되는 것과 같다. 직접 `converter.convert()` 를 부르지 않는다.

그래서 `ingestDocument` 의 실제 단계는 이렇다.

| 단계 | 위치 | 코드 |
|---|---|---|
| 청킹 | `documents.ts:166` | `chunkText(input.text, 120)` |
| 임베딩 + 저장 | `incremental.ts:174` → Chroma 내부 → `ollama-embedding.ts:69` | `collection.upsert({ documents })` 한 번에 |

눈으로 확인하려면 `npm run lec:10` (임베딩 호출 시점 강의).

---

## 1. `chunking/fixed.ts` — `chunkText`

```ts
export function chunkText(text: string, chunkSize = 120): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ""
```

| 문법 | 자바 |
|---|---|
| `chunkSize = 120` | 기본값 파라미터. 오버로딩 대신 씀 |
| `string[]` | `List<String>` |
| `text.split(/정규식/)` | `text.split("정규식")`. `/.../` 가 정규식 리터럴 |
| `const` / `let` | `final` 지역변수 / 재할당 가능 변수. 기본은 `const` |

```ts
  const push = (piece: string) => {
    ...
    chunks.push(trimmed)
  }
```

**함수 안에 함수.** 바깥의 `chunks` 를 그대로 캡처한다. 자바 람다가 바깥 `final` 변수를 캡처하는 것과 같은데, JS 는 재할당되는 변수도 캡처할 수 있다. `push` 는 값이 함수인 `const` 변수라 `push(current)` 로 그냥 부른다.

```ts
  for (const sentence of sentences) {
```

`for (String sentence : sentences)`. `of` 가 자바의 `:`. (`for ... in` 은 키를 순회하는 다른 문법이니 배열에는 항상 `of`.)

---

## 2. `ollama-embedding.ts` — 텍스트 → 벡터

```ts
export class OllamaEmbeddingFunction implements EmbeddingFunction {
  readonly name: string
  private readonly url: string

  constructor(options: OllamaEmbeddingOptions = {}) {
    this.url = options.url ?? config.ollama.url
    this.name = `ollama-${this.model}`
  }
```

| 문법 | 자바 |
|---|---|
| `readonly` | `final` 필드 |
| `constructor(options = {})` | 생성자. 옵션 객체 + 기본값이 오버로딩을 대신함 |
| `a ?? b` | `Optional.ofNullable(a).orElse(b)`. `null`/`undefined` 일 때만 `b` |
| `` `ollama-${x}` `` | `String.format("ollama-%s", x)`. 백틱 안에서 `${}` |

```ts
  async generate(texts: string[]): Promise<number[][]> {
    let response: Response
    try {
      response = await fetch(`${this.url}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts }),
      })
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new Error("...", { cause })
      }
      throw new Error("...", { cause })
    }
```

- `async` 함수는 항상 `Promise` 를 반환한다. `Promise<number[][]>` = `CompletableFuture<List<List<Double>>>`.
- `await` = `.join()` 처럼 읽고, `thenCompose` 처럼 동작한다(스레드를 안 막음).
- `fetch(url, { 옵션객체 })` = `HttpClient`. 두 번째 인자가 이름 있는 인자를 담은 **객체 리터럴**.
- `JSON.stringify` = 잭슨 `writeValueAsString`.
- `catch (cause)` 에서 타입을 못 고른다. 안에서 `instanceof` 로 직접 확인한다.
- `new Error(msg, { cause })` = `new Exception(msg, cause)`.

```ts
    const data = (await response.json()) as { embeddings?: number[][] }
    if (!data.embeddings || data.embeddings.length !== texts.length) throw ...
    return data.embeddings
```

`as { ... }` 는 캐스팅처럼 보이지만 **런타임 검사가 없다.** 그래서 바로 아래에서 직접 검증한다. `embeddings?` 의 `?` 는 "없을 수도 있는 필드".

---

## 3. `chroma.ts` — 싱글턴

```ts
export const client = new ChromaClient({ host, port, ssl })
export const embedder = new OllamaEmbeddingFunction()
```

모듈 최상위 `const` 는 **스프링 `@Bean` 싱글턴 자리**다. 모듈은 최초 `import` 때 한 번만 평가되므로 다른 파일에서 `import { client }` 하면 모두 같은 객체를 받는다. DI 컨테이너 없이 싱글턴이 된다.

```ts
export async function resetCollection(name: string): Promise<Collection> {
  await client.deleteCollection({ name }).catch(() => {})
  return client.getOrCreateCollection({ name, embeddingFunction: embedder })
}
```

- `{ name }` = `{ name: name }`. 변수명과 키가 같으면 한 번만 쓴다.
- `.catch(() => {})` = `exceptionally(e -> null)`. 없는 컬렉션 삭제 시 404 를 삼킨다.
- `embeddingFunction: embedder` — **여기서 임베딩 함수가 컬렉션에 등록된다** (0절 참고).

```ts
export async function runExample(title: string, fn: () => Promise<void>): Promise<void> {
```

`fn: () => Promise<void>` 는 "인자 없고 Promise 를 돌려주는 함수" 타입. `Supplier<CompletableFuture<Void>>`. TS 는 `Function<A,B>` 같은 이름 대신 **함수 시그니처 모양 그대로** 타입을 적는다.

---

## 4. `documents.ts` — ingest / search

### 4-1. 컬렉션 캐시

```ts
const collectionCache = new Map<string, Promise<Collection>>()

export function getCollection(name: string): Promise<Collection> {
  const cached = collectionCache.get(name)
  if (cached) return cached

  const promise = client
    .getOrCreateCollection({ name, embeddingFunction: embedder, metadata: { "hnsw:space": "cosine" } })
    .catch((error) => {
      collectionCache.delete(name)
      throw error
    })

  collectionCache.set(name, promise)
  return promise
}
```

- `Map<string, Promise<Collection>>` = `Map<String, CompletableFuture<Collection>>`. **결과가 아니라 진행 중인 작업을 캐싱**한다. 동시에 요청이 와도 `getOrCreate` 는 한 번만 실행된다.
- `if (cached)` — `null`/`undefined` 가 falsy 라 `!= null` 검사와 같다.
- `.catch((error) => { ... })` = `.exceptionally(error -> { ... })`. 화살표 방향만 다르다.
- 이 함수에 `async` 가 없는 건 의도다. `await` 한 결과를 캐시에 넣으면 그 사이에 중복 실행이 생긴다.

### 4-2. `withCollection<T>` — 함수를 받는 제네릭

```ts
async function withCollection<T>(
  name: string,
  fn: (collection: Collection) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getCollection(name))
  } catch (error) {
    if (!(error instanceof ChromaNotFoundError)) throw error
    invalidateCollection(name)
    return await fn(await getCollection(name))
  }
}
```

```java
<T> CompletableFuture<T> withCollection(String name, Function<Collection, CompletableFuture<T>> fn)
```

`fn: (collection: Collection) => Promise<T>` — 파라미터 `fn` 의 타입이 함수다. `=>` 왼쪽이 인자, 오른쪽이 반환.
`return await fn(await getCollection(name))` — 안쪽부터: 컬렉션 꺼냄 → `fn` 호출 → 그 결과도 Promise 라 다시 기다림.
`ChromaNotFoundError` 면 캐시를 버리고 딱 한 번 재시도한다.

### 4-3. `SearchResult` 와 `searchDocuments`

```ts
export interface SearchResult {
  id: string
  document: string
  distance: number
  metadata: Record<string, unknown> | null
}
```

`record SearchResult(String id, String document, double distance, Map<String,Object> metadata)`.
`Record<string, unknown>` = `Map<String, Object>` (자바 `record` 와 무관). `| null` = `@Nullable`.

```ts
export async function searchDocuments(
  collectionName: string,
  query: string,
  nResults = 5,                        // 기본값
  where?: Record<string, unknown>,     // ? = 생략 가능
): Promise<SearchResult[]> {
  const result = await withCollection(collectionName, (collection) =>
    collection.query({
      queryTexts: [query],
      nResults,
      ...(where ? { where: where as never } : {}),
    }),
  )
```

- `(collection) => collection.query(...)` — 중괄호 없는 람다. 표현식 하나면 바로 반환.
- `[query]` = `List.of(query)`. 질문을 **텍스트로** 넘긴다. 임베딩은 Chroma 가 한다.
- `...(where ? { where } : {})` — 삼항 + **스프레드**. `where` 가 있으면 키를 넣고, 없으면 키 자체를 뺀다. `null` 을 넘기면 Chroma 가 거부해서 쓰는 트릭. `...obj` 는 `putAll(obj)` 느낌.

```ts
  const ids = result.ids[0] ?? []
  const documents = result.documents?.[0] ?? []

  return ids.map((id, i) => ({
    id,
    document: documents[i] ?? "",
    distance: distances[i] ?? 1,
    metadata: (metadatas[i] as Record<string, unknown> | null) ?? null,
  }))
}
```

- `result.ids[0]` — `query()` 는 질의를 여러 개 받아서 2차원 배열을 돌려준다. 질의가 하나라 `[0]`.
- `a?.[0]` — `a` 가 null 이면 에러 대신 `undefined`. `?.b`, `?.()` 도 같은 원리.
- `.map((id, i) => ...)` — 자바 스트림 `map` 인데 **인덱스도 같이** 온다.
- `=> ({ ... })` — **괄호 필수.** `=> { ... }` 는 함수 본문으로 해석돼서 객체를 리턴하지 못한다. 초보자 함정 1순위.
- `.map()` 이 새 배열을 돌려주므로 `collect(toList())` 가 없다.

### 4-4. `ingestDocument`

```ts
export async function ingestDocument(
  collectionName: string,
  input: IngestInput,
  now: number = Date.now(),
): Promise<{ chunkCount: number; ids: string[]; stats: IncrementalStats }> {
```

- 기본값에 함수 호출도 된다. 호출할 때마다 평가.
- 반환 타입을 이름 없이 인라인 구조로 적었다. 자바라면 record 하나를 만들어야 하는 자리.

```ts
  const chunks = chunkText(input.text, 120)                       // ① 청킹
  const ids = chunks.map((_, i) => `${source}-chunk-${i}`)
  const pending = chunks.map((text, i) => ({
    id: ids[i] as string,
    text,
    metadata: { ...input.metadata, source, chunkIdx: i },
    volatileMetadata: { ingestedAt: now },
  }))

  const stats = await withCollection(collectionName, (collection) =>
    incrementalUpsert(collection, source, pending),                // ② 임베딩 + 저장
  )
  return { chunkCount: chunks.length, ids, stats }
}
```

- `_` — "이 파라미터 안 씀" 관례. 자바 22 의 `_`.
- `` `${source}-chunk-${i}` `` — id 를 source+순번으로 고정해야 재인제스트 시 upsert 가 된다.
- `{ ...input.metadata, source, chunkIdx: i }` — 복사 후 덮어쓰기. **뒤에 쓴 키가 이긴다.** `new HashMap<>(input.metadata); put("source", ...)`.
- `ids[i] as string` — `ids[i]` 는 범위 밖일 수 있어 `string | undefined` 인데 "확실히 string" 이라고 컴파일러에 알림. 런타임 검사 없음.
- 마지막 `withCollection(...)` 람다가 **임베딩과 저장이 일어나는 자리**다. 실제 코드는 다음 파일.

---

## 5. `incremental.ts` — 바뀐 청크만 upsert

```ts
export async function incrementalUpsert(
  collection: Collection,
  source: string,
  chunks: readonly PendingChunk[],
  options: IncrementalOptions = {},
): Promise<IncrementalStats> {
  const previous = await collection.get({ where: { source } })     // 1. 기존 청크 조회
  const existing = new Map<string, string | undefined>()
  previous.ids.forEach((id, i) => {
    const meta = previous.metadatas?.[i] as Record<string, unknown> | null | undefined
    const hash = meta?.[HASH_KEY]
    existing.set(id, typeof hash === "string" ? hash : undefined)
  })

  const plan = planIncrementalUpsert(chunks, existing)             // 2. 뭘 다시 넣을지 계산 (순수 함수)

  await processInBatches(plan.changed, async (batch) => {          // 3. 바뀐 것만 upsert
    await collection.upsert({
      ids: batch.map((c) => c.id),
      documents: batch.map((c) => c.text),                          //   ← 텍스트만 넘김. Chroma 가 임베딩
      metadatas: batch.map((c) => (c.metadata ?? {}) as Record<string, string | number | boolean>),
    })
  }, { size: options.batchSize, onProgress: options.onProgress })

  if (plan.staleIds.length > 0) {
    await collection.delete({ ids: plan.staleIds })                 // 4. 사라진 청크 삭제
  }
  return { changed: plan.changed.length, unchanged: plan.unchangedIds.length, removed: plan.staleIds.length }
}
```

- `readonly PendingChunk[]` = `unmodifiableList`. 이 함수 안에서 `push` 못 함.
- `.forEach((id, i) => ...)` — 인덱스 같이 받는 forEach.
- `typeof hash === "string"` — 런타임 타입 검사. 자바 `instanceof String`.
- `===` — 자바 `==`. JS 의 `==` 는 형변환을 해서 쓰지 않는다.
- `async (batch) => { ... }` — 람다에도 `async` 를 붙일 수 있다. 안에서 `await` 쓰려고.
- **`collection.upsert({ documents })` 가 임베딩과 저장이 동시에 일어나는 한 줄**이다. `embeddings` 없이 `documents` 만 주면 등록된 `embedder.generate()` 가 호출된다.

같은 문서를 두 번 인제스트하면 두 번째는 `plan.changed` 가 비어서 Ollama 호출이 한 번도 안 일어난다. `stats.unchanged` 가 그 수다.

```ts
export function planIncrementalUpsert(chunks, existing): IncrementalPlan {
  ...
  changed.push({
    ...chunk,
    metadata: { ...chunk.metadata, ...chunk.volatileMetadata, [HASH_KEY]: hash },
  })
  ...
  const staleIds = [...existing.keys()].filter((id) => !currentIds.has(id))
```

- `[HASH_KEY]: hash` — **키를 변수로** 쓰는 문법(computed key). `map.put(HASH_KEY, hash)`.
- `[...existing.keys()]` — 이터레이터를 배열로. `new ArrayList<>(map.keySet())`.

---

## 6. `llm.ts` — 채팅 호출

```ts
export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}
```

`role` 은 세 문자열만 허용하는 **리터럴 유니온**. 자바 `enum` 자리. `type` 은 `interface` 와 비슷하지만 유니온도 표현할 수 있다.

```ts
export async function chatComplete(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  ...
  response = await fetch(`${config.ollama.url}/api/chat`, {
    body: JSON.stringify({
      model: config.ollama.chatModel,
      messages,
      stream: false,
      ...(options.format ? { format: options.format } : {}),
      options: { temperature: options.temperature ?? 0 },
    }),
  })
  ...
  const data = (await response.json()) as { message?: { content?: string } }
  return data.message?.content ?? ""
}
```

`ollama-embedding.ts` 와 구조가 같다. 엔드포인트가 `/api/embed` → `/api/chat` 이고, 응답에서 `message.content` 를 꺼낸다. `data.message?.content ?? ""` 는 두 단계 어느 쪽이 없어도 빈 문자열.

---

## 7. `rag.ts` — 검색 → 컨텍스트 → 생성

### 7-1. `answerQuestion` — 핵심 4줄

```ts
export async function answerQuestion(question: string, nResults = 3): Promise<AnswerResult> {
  const sources = await searchDocuments(RAG_COLLECTION, question, nResults)   // 검색 (질문 임베딩은 Chroma 가)
  const context = buildContext(sources)                                       // 검색 결과 → 문자열
  const answer = await chatComplete(buildMessages(question, context))         // LLM 호출
  return { answer, sources, citations: checkCitations(answer, sources.length) }
}
```

마지막 줄의 `{ answer, sources, citations: ... }` — 변수명과 키가 같은 건 축약, `citations` 는 변수가 없으니 `키: 값`. `new AnswerResult(answer, sources, checkCitations(...))`.

### 7-2. `RagDependencies` — 인터페이스를 객체 리터럴로 구현

```ts
export interface RagDependencies {
  search(question: string, nResults: number): Promise<SearchResult[]>
  generate(messages: ChatMessage[]): Promise<string>
}

export async function answerQuestionReliably(
  question: string,
  nResults = 3,
  dependencies: RagDependencies = {
    search: (query, count) => searchDocuments(RAG_COLLECTION, query, count),
    generate: (messages) => chatComplete(messages),
  },
  maxAttempts = 2,
): Promise<ReliableAnswer> {
```

인터페이스는 자바와 같다. 차이는 **구현 클래스도 익명 클래스도 없이 객체 리터럴로 바로 구현**한다는 것. 모양만 맞으면 통과한다(구조적 타이핑). 람다 파라미터에 타입이 없는 건 인터페이스에서 추론되기 때문.

이게 의존성 주입이다. 테스트 때 진짜 Chroma/Ollama 대신 가짜 `search`/`generate` 를 넘긴다. 스프링 `@MockBean` 자리.

### 7-3. 재시도 루프

```ts
  let answer = ""
  let citations = checkCitations(answer, sources.length)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const messages = attempt === 1
      ? baseMessages
      : [
          ...baseMessages,
          { role: "assistant", content: answer } as const,
          { role: "user", content: "..." } as const,
        ]
    answer = await dependencies.generate(messages)
    citations = checkCitations(answer, sources.length)
    if (sources.length === 0 || (!citations.missing && citations.invalid.length === 0)) {
      return { answer, sources, citations, attempts: attempt }
    }
  }
```

- `let` — 루프에서 재할당하니까.
- `for (let i = 1; ...; i++)` — 자바와 동일.
- `[...baseMessages, a, b]` — **배열 스프레드.** 기존 배열을 펼치고 뒤에 두 개 추가. `Stream.concat`.
- `as const` — `role: "assistant"` 를 `string` 이 아니라 리터럴 `"assistant"` 로 고정. `ChatMessage.role` 이 유니온이라 `string` 이면 타입이 안 맞는다. "enum 상수로 취급해라" 정도로 이해.

### 7-4. `buildContext` — 스트림 파이프라인

```ts
function buildContext(sources: SearchResult[]): string {
  return sources
    .map((s, i) => {
      const source = s.metadata?.source ?? "unknown"
      const relevance = (1 - s.distance).toFixed(2)
      return `[자료 ${i + 1} - 출처: ${source}, 관련도: ${relevance}]\n${s.document}`
    })
    .join("\n\n")
}
```

```java
IntStream.range(0, sources.size()).mapToObj(i -> ...).collect(joining("\n\n"))
```

`.toFixed(2)` = `String.format("%.2f")`, 반환은 문자열. `.join` 이 배열에 바로 붙어 있다.

### 7-5. `buildMessages`

```ts
function buildMessages(question: string, context: string, history: readonly ChatMessage[] = []): ChatMessage[] {
  return [
    { role: "system", content: `당신은 ...
다음 규칙을 ...` },
    ...history,
    { role: "user", content: `... ${context} ... ${question}` },
  ]
}
```

- 백틱 문자열은 **줄바꿈을 그대로 포함**한다. 자바 15 텍스트 블록 `"""`.
- `...history` — 배열 리터럴 중간에 다른 배열을 끼워 넣는다. `[system, 과거 대화..., 이번 질문]`.
- 여기선 `as const` 가 없다. 반환 타입이 `ChatMessage[]` 로 선언돼 있어 컴파일러가 거기 맞춰 추론한다. 7-3 에서는 `const messages` 에 타입 선언이 없어서 필요했다.

### 7-6. `answerInConversation`

```ts
export const conversations = new ConversationStore()          // 모듈 싱글턴

export async function answerInConversation(
  sessionId: string, question: string, nResults = 3,
  store: ConversationStorePort = conversations,                // DI, 기본값은 싱글턴
): Promise<ConversationalAnswer> {
  const history = trimHistory(store.get(sessionId))
  const searchQuery = await condenseQuestion(history, question)  // 대화 맥락으로 질문 압축
  const sources = await searchDocuments(RAG_COLLECTION, searchQuery, nResults)
  const context = buildContext(sources)
  const answer = await chatComplete(buildMessages(question, context, history))
  store.append(sessionId, question, answer)
  return { answer, sources, searchQuery, citations: checkCitations(answer, sources.length) }
}
```

`answerQuestion` 에 압축과 기록이 추가된 것. 새 문법 없음.

---

## 8. 반복되는 문법 치트시트

이 7개 파일에서 계속 나오는 것. 검색 개선 코드에서 추가로 나오는 문법(타입 가드, 구조분해, class 등)은 [검색 개선·보조 코드 읽기](search-code-walkthrough.md)에 이어진다.

| TS | 자바 | 비고 |
|---|---|---|
| `(x) => expr` / `(x) => { ... }` | `x -> expr` / `x -> { ... }` | 화살표 방향만 다름 |
| `=> ({ ... })` | 객체를 바로 리턴 | **괄호 필수.** `=> { }` 는 함수 본문 |
| `fn: (a: A) => B` | `Function<A, B> fn` | 함수 타입은 시그니처 모양 그대로 |
| `{ name, key: value }` | 익명 DTO / 이름 있는 인자 | `{ name }` = `{ name: name }` |
| `...obj` / `[...arr, x]` | `putAll` / `Stream.concat` | 스프레드. 뒤에 쓴 키가 이김 |
| `a ?? b` | `Optional.ofNullable(a).orElse(b)` | `null`/`undefined` 만 대체 |
| `a?.b` / `a?.[0]` | null-safe 접근 | null 이면 에러 대신 `undefined` |
| `a === b` | `a == b` | JS 의 `==` 는 형변환하므로 안 씀 |
| `.map((x, i) => ...)` | `IntStream.range` + `mapToObj` | 인덱스가 같이 온다 |
| `x as T` | `(T) x` | **런타임 검사 없음** |
| `as const` | enum 상수 취급 | 리터럴 유니온 타입에 맞출 때 |
| `readonly T[]` | `unmodifiableList` | 파라미터 불변 선언 |
| `Record<string, unknown>` | `Map<String, Object>` | 자바 `record` 와 무관 |
| `interface` 를 `{ ... }` 로 구현 | 익명 클래스 | 구조만 맞으면 통과 |
| 모듈 최상위 `export const x = new X()` | `@Bean` 싱글턴 | 모듈은 한 번만 로드 |
| `async` / `await` / `Promise<T>` | `CompletableFuture<T>` / `.join()` | 스레드는 안 막음 |
| `` `${a}-${b}` `` | `String.format` | 줄바꿈도 포함 가능 |
| `[KEY]: value` | `map.put(KEY, value)` | 키를 변수로 |

## 9. 확인 질문

읽고 나서 다음에 답할 수 있으면 이 문서는 끝이다.

1. `ingestDocument` 에서 임베딩은 어느 줄에서, 누가 호출하는가?
2. `getCollection` 에 `async` 를 붙이면 왜 문제가 되는가?
3. `searchDocuments` 에서 `result.ids[0]` 의 `[0]` 은 무엇을 뜻하는가?
4. `answerQuestionReliably` 의 `dependencies` 파라미터는 왜 있는가?
5. `as const` 를 빼면 `answerQuestionReliably` 는 왜 컴파일이 안 되는가?
