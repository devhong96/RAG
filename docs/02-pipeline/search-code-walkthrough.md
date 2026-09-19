# 검색 개선·보조 코드 읽기 (자바 개발자용)

[핵심 파이프라인 코드 읽기](core-code-walkthrough.md)의 후속이다. 그 문서의 7개 파일을 읽었다는 전제로, **거기서 안 나온 문법만** 다룬다. 이미 본 문법(`?.`, `??`, 스프레드, `=> ({})`, `as const` 등)은 설명 없이 지나간다.

여기서 새로 나오는 문법은 다섯 가지다.

| 문법 | 처음 나오는 곳 |
|---|---|
| 튜플 구조분해 `([id, s]) => ...` | 1절 `hybrid.ts` |
| 타입 가드 `(p): p is T => ...` | 2절 `rerank.ts` |
| `[...new Set(arr)]` 중복 제거 | 3절 `parent-child.ts` |
| `class` — 파라미터 프로퍼티, getter | 4절 `conversation.ts` |
| `.reduce()`, `Array.from({ length })` | 5절 `vector-math.ts` |

## 목차

| 절 | 파일 | 역할 | 새 문법 |
|:---:|---|---|---|
| [1](#1-searchhybridts--벡터--키워드) | `search/hybrid.ts` | 벡터 + 키워드 점수 합산, RRF | `Map` 누적, 튜플 구조분해 |
| [2](#2-searchrerankts--크로스-인코더-재랭킹) | `search/rerank.ts` | 후보를 넓게 뽑고 다시 줄 세우기 | 타입 가드, 동적 `import()`, `any` |
| [3](#3-searchparent-childts--자식으로-찾고-부모를-넘기기) | `search/parent-child.ts` | 작은 청크로 검색, 큰 청크로 답변 | `[...new Set()]`, `break` |
| [4](#4-conversationts--멀티턴-대화) | `conversation.ts` | 질문 압축, 세션 저장소 | `class`, 파라미터 프로퍼티, getter, `\|\|` |
| [5](#5-vector-mathts--벡터-연산) | `vector-math.ts` | 내적·코사인·중심점·Flat 검색 | `reduce`, `**`, `Array.from`, 파라미터 구조분해 |
| [6](#6-citationsts--인용-검사) | `citations.ts` | `[자료 N]` 표기 검사 | 정규식 `g`, `matchAll`, `Set` |
| [7](#7-추가-문법-치트시트) | — | 추가 문법 치트시트 | — |

---

## 1. `search/hybrid.ts` — 벡터 + 키워드

### 1-1. 점수 누적

```ts
const score = new Map<string, number>()

vector.ids[0]?.forEach((id, i) => {
  const similarity = 1 - (vector.distances?.[0]?.[i] ?? 1)
  score.set(id, (score.get(id) ?? 0) + similarity)
})

keywordHit.ids.forEach((id) => {
  score.set(id, (score.get(id) ?? 0) + keywordBoost)
})
```

`Map<String, Double>` 에 id 별로 점수를 더한다. `(score.get(id) ?? 0) + x` 가 자바 `score.merge(id, x, Double::sum)` 자리다. JS `Map` 에는 `merge` 가 없어서 get → 없으면 0 → 더해서 set 을 손으로 쓴다.

`vector.ids[0]?.forEach(...)` — `ids[0]` 이 없을 수도 있어서 `?.` 를 붙였다. 없으면 `forEach` 자체가 실행되지 않고 `undefined` 로 끝난다(에러 없음).

### 1-2. 튜플 구조분해 — 이 파일의 핵심 문법

```ts
return [...score.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, nResults)
  .map(([id, s]) => ({ id, score: s }))
```

- `score.entries()` 는 `[키, 값]` 쌍의 **이터레이터**를 돌려준다. `[...]` 로 배열로 편다. 자바 `new ArrayList<>(map.entrySet())`.
- 각 원소는 길이 2 짜리 배열 `[id, score]` 다. 자바 `Map.Entry` 대신 배열을 쓴다.
- `.sort((a, b) => b[1] - a[1])` — `a[1]` 은 값(점수). 내림차순. 자바 `Comparator.comparing(Entry::getValue).reversed()`.
  - JS 의 `sort` 는 **비교 함수가 음수/0/양수를 돌려줘야** 한다. `b - a` 면 내림차순, `a - b` 면 오름차순. 자바 `compareTo` 와 같은 규약.
  - 주의: 인자 없이 `.sort()` 만 부르면 숫자도 **문자열로** 정렬한다(`[10, 9, 1]` → `[1, 10, 9]`). 숫자 정렬에는 항상 비교 함수를 준다.
- `.map(([id, s]) => ...)` — **파라미터 자리에서 배열을 바로 분해**한다. `(entry) => { const id = entry[0]; const s = entry[1]; ... }` 를 한 줄로 줄인 것. 자바에는 대응 문법이 없고, `entry.getKey()`, `entry.getValue()` 로 꺼내는 걸 대신한다.

```ts
return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
```

`rrfMerge` 의 마지막 줄. `([id]) => id` 는 두 번째 원소를 안 쓰니까 첫 번째만 받은 것. `.map(Entry::getKey)`.

### 1-3. RRF 계산

```ts
for (const ranking of rankings) {
  ranking.forEach((id, rank) => {
    score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1))
  })
}
```

`rankings: string[][]` 는 `List<List<String>>`. 바깥은 `for...of`, 안쪽은 `forEach` 인데 인덱스(`rank`)가 필요해서 그렇다. 두 개를 섞어 쓰는 건 흔하다.

---

## 2. `search/rerank.ts` — 크로스 인코더 재랭킹

### 2-1. 동적 `import()` 와 `any`

```ts
let cachedTokenizer: unknown = null
let cachedModel: unknown = null

async function load() {
  if (!cachedTokenizer || !cachedModel) {
    const { AutoTokenizer, AutoModelForSequenceClassification, env } = await import("@xenova/transformers")
    env.cacheDir = config.reranker.cacheDir
    cachedTokenizer = await AutoTokenizer.from_pretrained(config.reranker.modelId)
    cachedModel = await AutoModelForSequenceClassification.from_pretrained(config.reranker.modelId)
  }
  return { tokenizer: cachedTokenizer as any, model: cachedModel as any }
}
```

- `await import("...")` — 파일 맨 위 `import` 와 달리 **함수 안에서 필요할 때 로드**한다. 무거운 라이브러리(여기선 로컬 ML 모델)를 실제로 쓸 때까지 안 읽으려는 것. 자바 `Class.forName()` 지연 로딩과 비슷한 목적.
- `const { A, B, env } = await import(...)` — **객체 구조분해.** 모듈이 export 한 것 중 세 개만 꺼낸다. 1절의 배열 구조분해 `[id, s]` 의 객체 버전이고, 키 이름으로 꺼내니 순서는 상관없다.
- `unknown` — "타입을 모른다". `Object` 와 비슷하지만 **뭘 하려면 먼저 타입을 좁혀야** 한다. 여기선 그 라이브러리가 타입 정보를 제대로 안 줘서 임시로 둔 것.
- `as any` — 타입 검사를 **끈다.** 이후 `tokenizer(...)`, `model(...)` 처럼 아무렇게나 불러도 컴파일이 통과한다. 자바로 치면 리플렉션으로 아무 메서드나 부르는 것과 같이 위험하다. 외부 라이브러리 타입이 불완전할 때 도피처로 쓰지, 자기 코드에는 쓰지 않는다.
- `load()` 에 반환 타입이 없다. `return { tokenizer, model }` 에서 `Promise<{ tokenizer: any; model: any }>` 로 추론된다.

### 2-2. 타입 가드 — 이 파일의 핵심 문법

```ts
const pairs = rawIds
  .map((id, i) => ({ id, doc: rawDocs[i] }))
  .filter((p): p is { id: string; doc: string } => typeof p.doc === "string")
```

`rawDocs[i]` 는 `string | null` 이라 `.map` 결과는 `{ id: string; doc: string | null }[]` 다. `.filter` 로 `null` 인 것을 걸러내도 **컴파일러는 그걸 모른다.** 일반 `filter((p) => typeof p.doc === "string")` 을 쓰면 결과 타입이 여전히 `doc: string | null` 이라 다음 줄에서 `p.doc` 을 문자열로 못 쓴다.

`(p): p is { id: string; doc: string } => ...` 가 **타입 가드**다. "이 함수가 `true` 를 돌려주면 `p` 는 이 타입이다"라고 컴파일러에 알린다. 그러면 `filter` 결과가 `{ id: string; doc: string }[]` 로 좁아진다.

자바에는 없다. 가장 가까운 건 `instanceof` 패턴 매칭(`if (o instanceof String s)`)인데, 그건 `if` 안에서만 좁혀지고 이건 **스트림 파이프라인 안에서** 좁혀진다는 게 다르다.

읽는 법: `(파라미터): 파라미터 is 타입 => 조건`. `is` 왼쪽은 파라미터 이름과 같아야 한다.

### 2-3. 나머지

```ts
include: ["documents"] as const,
```

`include` 옵션은 `"documents" | "metadatas" | ...` 유니온 배열을 받는다. `as const` 가 없으면 `string[]` 으로 추론돼 안 맞는다. `rag.ts` 에서 본 것과 같은 이유.

```ts
return Array.from(output.logits.data as Float32Array)
```

`Float32Array` 는 자바 `float[]` 에 해당하는 **타입 배열**(고정 타입, 메모리 효율). 일반 배열 메서드가 다 있지는 않아서 `Array.from` 으로 `number[]` 로 바꾼다.

```ts
.map((p, i) => ({ ...p, score: scores[i] ?? -Infinity }))
.sort((a, b) => b.score - a.score)
.slice(0, topK)
```

`-Infinity` = `Double.NEGATIVE_INFINITY`. 점수가 없으면 맨 뒤로 보내려는 것. `.slice(0, topK)` = `subList(0, topK)` 인데 범위를 넘어도 에러 없이 있는 만큼만 돌려준다.

---

## 3. `search/parent-child.ts` — 자식으로 찾고 부모를 넘기기

### 3-1. `trimContext` — `break`

```ts
export function trimContext(docs: string[], maxChars = 4000): string[] {
  const result: string[] = []
  let used = 0
  for (const doc of docs) {
    if (used + doc.length > maxChars) break
    result.push(doc)
    used += doc.length
  }
  return result
}
```

자바와 완전히 같다. `for...of` 안에서 `break`, `continue` 다 된다. (`forEach` 콜백 안에서는 `break` 가 안 되니, 중간에 멈춰야 하면 `for...of` 를 쓴다.)

### 3-2. `[...new Set()]` — 중복 제거 관용구

```ts
const parentIds = [
  ...new Set(
    (childHit.metadatas?.[0] ?? [])
      .map((m) => m?.parentId)
      .filter((id): id is string => typeof id === "string"),
  ),
]
```

안쪽부터:
1. `metadatas[0]` 에서 각 청크의 `parentId` 를 꺼낸다. 없을 수 있어 `m?.parentId`.
2. 타입 가드로 `string` 만 남긴다 (2절과 같은 문법).
3. `new Set(배열)` — 중복 제거. 자바 `new HashSet<>(list)`.
4. `[...set]` — 다시 배열로. 자바 `new ArrayList<>(set)`.

`[...new Set(arr)]` 는 JS 에서 **"배열 중복 제거"의 관용구**다. 자바 `list.stream().distinct().toList()`.

자식 청크 여러 개가 같은 부모를 가리킬 수 있어서(한 부모를 5개 자식으로 잘랐으니) 부모 id 를 중복 없이 모으는 것.

```ts
(parents.documents ?? []).filter((d): d is string => d !== null),
```

타입 가드 한 번 더. `documents` 는 `(string | null)[]` 라 `null` 을 걸러 `string[]` 으로.

---

## 4. `conversation.ts` — 멀티턴 대화

### 4-1. 인터페이스에 `readonly` 프로퍼티

```ts
export interface ConversationStorePort {
  get(sessionId: string): ChatMessage[]
  append(sessionId: string, question: string, answer: string): void
  clear(sessionId: string): void
  readonly size: number
}
```

메서드 세 개 + **읽기 전용 프로퍼티** 하나. 자바 인터페이스에는 필드를 못 두지만 TS 는 된다. 구현체는 `size` 를 필드로 둬도 되고 getter 로 둬도 된다(아래 4-4).

### 4-2. `||` vs `??`

```ts
const condensed = (await chatComplete(messages)).trim().split("\n")[0]?.trim()
return condensed || question
```

- `(await x).trim()` — `await` 결과에 바로 메서드를 붙이려면 괄호가 필요하다. `await x.trim()` 은 `x.trim()` 을 먼저 하려 해서 틀린다.
- `.split("\n")[0]?.trim()` — 첫 줄. 배열 인덱스 결과가 `undefined` 일 수 있어 `?.`.
- `condensed || question` — **`??` 가 아니라 `||`** 인 점에 주의. `??` 는 `null`/`undefined` 만 대체하지만, `||` 는 **빈 문자열 `""`, `0`, `false` 도** 대체한다. 여기선 LLM 이 빈 줄을 뱉었을 때도 원문으로 돌리고 싶으니 `||` 가 맞다. 자바에는 없는 구분이라 헷갈리기 쉽다.

| | `a ?? b` | `a \|\| b` |
|---|---|---|
| `a = null` | b | b |
| `a = ""` | `""` | b |
| `a = 0` | `0` | b |

### 4-3. `class` — 파라미터 프로퍼티

```ts
export class ConversationStore implements ConversationStorePort {
  private readonly sessions = new Map<string, ChatMessage[]>()

  constructor(private readonly maxTurns = MAX_TURNS) {}
```

- `private readonly sessions = new Map(...)` — 필드 선언과 초기화를 한 줄에. 자바와 같다.
- `constructor(private readonly maxTurns = MAX_TURNS) {}` — **파라미터 프로퍼티.** 생성자 파라미터에 `private`/`readonly` 를 붙이면 **같은 이름의 필드가 자동으로 생기고 대입까지 된다.** 자바로 풀면:

```java
private final int maxTurns;
public ConversationStore(int maxTurns) { this.maxTurns = maxTurns; }
```

세 줄이 한 줄로 줄어든 것. 본문이 비어 있는(`{}`) 이유다. 롬복 `@RequiredArgsConstructor` 와 비슷한 효과.

### 4-4. getter

```ts
  get size(): number {
    return this.sessions.size
  }
```

`get` 키워드를 붙이면 **메서드인데 필드처럼 읽는다.** 호출은 `store.size` (괄호 없음). 자바 `getSize()` 를 `size` 로 부르는 셈. 4-1 인터페이스의 `readonly size: number` 를 이걸로 만족시킨다.

`set size(v) { ... }` 도 있는데 이 레포에선 안 쓴다.

### 4-5. `append`

```ts
  append(sessionId: string, question: string, answer: string): void {
    const next = [
      ...this.get(sessionId),
      { role: "user", content: question } as const,
      { role: "assistant", content: answer } as const,
    ]
    this.sessions.set(sessionId, trimHistory(next, this.maxTurns))
  }
```

기존 기록을 펼치고 두 개를 붙여 **새 배열**을 만든 뒤 잘라서 저장한다. 기존 배열을 `push` 로 변형하지 않는다. 자바에서 `List.copyOf` 로 불변 유지하는 습관과 같다.

---

## 5. `vector-math.ts` — 벡터 연산

### 5-1. `.reduce()`

```ts
export function dotProduct(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * (b[i] as number), 0)
}
```

```java
double sum = 0;
for (int i = 0; i < a.length; i++) sum += a[i] * b[i];
```

`reduce((누적값, 현재값, 인덱스) => 새 누적값, 초기값)`. 자바 스트림 `reduce(0.0, (sum, v) -> ...)` 와 같은데 두 가지가 다르다.

- **초기값이 두 번째 인자**로 뒤에 온다. 자바는 첫 번째.
- 콜백에 **인덱스가 세 번째로** 온다. 그래서 `b[i]` 를 같이 볼 수 있다. 자바 스트림은 인덱스가 없어 `IntStream.range` 로 우회해야 하는 자리.

`(b[i] as number)` — `b[i]` 는 범위 밖일 수 있어 `number | undefined` 인데, 위에서 `assertComparable` 로 길이를 맞췄으니 확실하다고 알려주는 것.

```ts
return Math.sqrt(a.reduce((sum, value, i) => sum + (value - (b[i] as number)) ** 2, 0))
```

`**` — 거듭제곱. `Math.pow(x, 2)` 와 같다. 자바에는 연산자가 없다.

### 5-2. `Array.from({ length })`

```ts
return Array.from({ length: dimension }, (_, i) =>
  vectors.reduce((sum, vector) => sum + (vector[i] as number), 0) / vectors.length,
)
```

`Array.from({ length: n }, (_, i) => f(i))` — **길이 n 짜리 배열을 만들면서 각 자리를 `f(i)` 로 채운다.** 자바 `IntStream.range(0, n).mapToDouble(i -> f(i)).toArray()`. 첫 인자가 `_` 인 건 원소값을 안 쓰기 때문(`undefined` 가 들어온다).

안쪽 `reduce` 는 "모든 벡터의 i 번째 값 합 / 개수" = i 번째 차원의 평균.

### 5-3. 파라미터 구조분해

```ts
export function topKByCosine<T>(
  query: readonly number[],
  candidates: readonly { item: T; vector: readonly number[] }[],
  k: number,
): RankedVector<T>[] {
  return candidates
    .map(({ item, vector }) => {
      const similarity = cosineSimilarity(query, vector)
      return { item, similarity, distance: 1 - similarity }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}
```

- `readonly { item: T; vector: readonly number[] }[]` — "`item` 과 `vector` 를 가진 객체의 읽기 전용 배열". 인라인 타입에 제네릭 `T` 가 들어갔다.
- `.map(({ item, vector }) => ...)` — **객체 구조분해**를 파라미터에서. `(c) => { const item = c.item; const vector = c.vector; ... }` 의 축약. 1절의 `([id, s])` 가 배열 버전이라면 이건 객체 버전.
- `readonly (readonly number[])[]` (`centroid`) — 바깥도 안쪽도 읽기 전용인 2차원 배열. 괄호가 있어야 안쪽 `readonly` 가 `number[]` 에만 걸린다.

---

## 6. `citations.ts` — 인용 검사

### 6-1. 정규식 리터럴과 `g` 플래그

```ts
const CITATION_PATTERN = /\[자료\s*([\d\s,]+)\]/g
```

`/.../g` 가 정규식 리터럴. `g` 는 **global** — "전부 찾아라". 이게 없으면 `matchAll` 이 에러를 낸다. 자바 `Pattern.compile("\\[자료\\s*([\\d\\s,]+)\\]")` 인데, 리터럴이라 백슬래시를 두 번 안 써도 된다.

### 6-2. `matchAll` 과 캡처 그룹

```ts
const found = new Set<number>()

for (const match of answer.matchAll(CITATION_PATTERN)) {
  for (const piece of (match[1] ?? "").split(",")) {
    const n = Number(piece.trim())
    if (Number.isInteger(n) && n > 0) found.add(n)
  }
}
```

- `answer.matchAll(정규식)` — 매치 결과의 이터레이터. `for...of` 로 돈다. 자바 `while (matcher.find())`.
- `match[1]` — 첫 번째 **캡처 그룹**(괄호 안). `matcher.group(1)`. `match[0]` 은 전체 매치.
- `Number(str)` — 문자열 → 숫자. 실패하면 예외 대신 `NaN` 을 돌려준다. 그래서 바로 `Number.isInteger` 로 검사한다. 자바 `Integer.parseInt` 가 던지는 `NumberFormatException` 을 안 던진다는 게 함정.
- `new Set<number>()` + `.add(n)` — `HashSet<Integer>`. 중복 자동 제거.

```ts
const cited = [...found].sort((a, b) => a - b)
```

`Set` → 배열 → 오름차순. 3절의 `[...new Set()]` 과 같은 패턴인데, 여기선 `Set` 을 먼저 만들고 나중에 편다.

---

## 7. 추가 문법 치트시트

[핵심 파이프라인 문서의 치트시트](core-code-walkthrough.md#8-반복되는-문법-치트시트)에 없던 것만.

| TS | 자바 | 비고 |
|---|---|---|
| `([a, b]) => ...` | `entry.getKey()`, `getValue()` | 배열(튜플) 구조분해 |
| `({ a, b }) => ...` / `const { a, b } = obj` | `obj.getA()`, `getB()` | 객체 구조분해. 순서 무관 |
| `(x): x is T => cond` | `instanceof` 패턴 매칭 | 타입 가드. `filter` 결과 타입을 좁힘 |
| `[...new Set(arr)]` | `stream().distinct()` | 중복 제거 관용구 |
| `[...map.entries()]` | `new ArrayList<>(map.entrySet())` | 이터레이터 → 배열 |
| `.sort((a, b) => a - b)` | `Comparator` | **비교 함수 필수.** 없으면 문자열 정렬 |
| `constructor(private readonly x)` | 필드 + 생성자 대입 | 파라미터 프로퍼티 |
| `get size() { }` | `getSize()` | 괄호 없이 `obj.size` 로 읽음 |
| `a \|\| b` | — | `""`, `0`, `false` 도 대체. `??` 와 구분 |
| `.reduce((acc, v, i) => ..., init)` | `stream().reduce(init, ...)` | 초기값이 **뒤**, 인덱스 있음 |
| `Array.from({ length: n }, (_, i) => f(i))` | `IntStream.range(0, n).map(f)` | 길이 n 배열 생성 |
| `x ** 2` | `Math.pow(x, 2)` | 거듭제곱 연산자 |
| `await import("mod")` | `Class.forName` | 지연 로딩 |
| `unknown` / `any` | `Object` / 타입 검사 끔 | `any` 는 외부 라이브러리 도피처로만 |
| `/regex/g` + `matchAll` | `Pattern` + `matcher.find()` 루프 | `g` 없으면 `matchAll` 에러 |
| `match[1]` | `matcher.group(1)` | 캡처 그룹 |
| `Number(str)` | `Integer.parseInt` | 실패 시 예외 대신 `NaN` |
| `Float32Array` | `float[]` | 타입 배열. `Array.from` 으로 변환 |
| `-Infinity` | `Double.NEGATIVE_INFINITY` | |

## 8. 확인 질문

1. `hybrid.ts` 마지막 줄의 `([id, s])` 를 구조분해 없이 쓰면 어떻게 되는가?
2. `rerank.ts` 의 `filter` 에서 타입 가드를 빼면 어느 줄에서 컴파일 에러가 나는가?
3. `[...new Set(arr)]` 에서 `new Set` 과 `[...]` 는 각각 무슨 역할인가?
4. `condenseQuestion` 이 `??` 대신 `||` 를 쓴 이유는?
5. `constructor(private readonly maxTurns = MAX_TURNS) {}` 를 자바로 풀면 몇 줄인가?
6. JS 의 `.sort()` 에 비교 함수를 안 주면 `[10, 9, 1]` 은 어떻게 정렬되는가?
