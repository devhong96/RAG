# RAG 학습 가이드

이 저장소는 파일 목록 순서대로 읽는 책이 아니다. 같은 RAG 파이프라인을 개념, 코드, 실행 예제라는 서로 다른 각도에서 반복해서 보여준다. 처음부터 모든 문서를 정독하면 같은 설명이 반복되어 오히려 전체 흐름을 놓치기 쉽다.

권장 방식은 다음 한 묶음을 계속 반복하는 것이다.

```text
개념을 읽는다 → 대응 코드를 찾는다 → 직접 실행한다 → 결과가 왜 나왔는지 설명한다
```

## 문서 지도

문서는 읽는 단계별로 다섯 디렉터리에 나눠 두었다. 아래 표에서 필요한 묶음을 고르고, 순서가 고민되면 1절부터 따라간다.

| 디렉터리 | 무엇을 담았나 | 문서 |
|---|---|---|
| [`01-basics/`](01-basics/) | RAG·벡터·임베딩의 기본 개념 | [RAG 도입 기준](01-basics/rag-vs-modular-reading.md) · [RAG 전체 흐름](01-basics/rag-overall-flow.md) · [벡터 DB와 임베딩](01-basics/vector-db.md) · [임베딩 계보](01-basics/embedding-lineage.md) · [LLM 위키](01-basics/llm-wiki.md) |
| [`02-pipeline/`](02-pipeline/) | 파이프라인 설계와 이 저장소의 구현 | [RAG 상세 파이프라인](02-pipeline/rag-pipeline.md) · [실전 구현과 청킹 전략](02-pipeline/rag-practical-implementation.md) · [SQLite 의미 검색](02-pipeline/sqlite-vector-search.md) · [현재 코드 아키텍처](02-pipeline/rag-architecture.md) |
| [`03-graphrag/`](03-graphrag/) | 그래프 DB와 GraphRAG 확장 | [그래프 DB 입문](03-graphrag/graph-db-learning.md) · [GraphRAG 설계](03-graphrag/rag-graphdb-hybrid-pipeline.md) · [하이브리드 RAG 워크스루](03-graphrag/rag-hybrid-walkthrough.md) |
| [`04-patterns/`](04-patterns/) | 설계 패턴과 범위 정리 | [생성형 AI 설계 패턴](04-patterns/generative-ai-patterns.md) · [도서 목차 반영표](04-patterns/book-coverage.md) · [개념 노트 모음](04-patterns/rag-study-notes.md) |
| [`05-reference/`](05-reference/) | 실행할 때 찾아보는 참고 자료 | [강의 실습 목록](05-reference/lectures.md) · [파이프라인 실행 가이드](05-reference/pipelines.md) · [문제 해결](05-reference/troubleshooting.md) · [자바 개발자를 위한 노트](05-reference/자바개발자를-위한-노트.md) |

## 0. 시작 전에 준비할 것

이 프로젝트는 Node.js 22.5 이상, ChromaDB, Ollama를 사용한다. 처음 한 번만 다음 순서로 준비한다.

```bash
node --version
npm install
pipx install chromadb
ollama pull bge-m3
```

실습할 때는 별도 터미널에서 서비스를 실행한다.

```bash
# 터미널 1
ollama serve

# 터미널 2
npm run db
```

두 서비스가 모두 필요한 것은 아니다. 벡터 수학과 SQLite 단위 테스트는 외부 서비스 없이 실행할 수 있고, Chroma 검색 실습에는 둘 다 필요하다.

## 1. 시간이 얼마나 있는가

### 2시간 빠른 코스

RAG가 처음이고 전체 모양만 보고 싶을 때 선택한다.

1. [RAG 전체 흐름](01-basics/rag-overall-flow.md)
2. [벡터 DB와 임베딩](01-basics/vector-db.md) 1~3장
3. [`13-14-similarity-search.ts`](../src/lectures/13-14-similarity-search.ts)
4. [`23-24-rag.ts`](../src/lectures/23-24-rag.ts)

```bash
npm run lec:13-14
npm run lec:23-24
```

이 코스를 마치면 다음 문장을 자기 말로 설명할 수 있어야 한다.

> 질문을 임베딩해 가까운 문서 조각을 찾고, 그 원문을 LLM의 컨텍스트에 넣어 답을 생성한다.

### 하루 실습 코스

기본 검색부터 검색 품질 개선까지 직접 실행하려면 아래 **2~6절**을 따른다. 처음에는 GraphRAG와 OCR을 건너뛴다.

### 깊이 공부하는 코스

2~6절을 끝낸 뒤 **7절 확장 코스**와 [생성형 AI 설계 패턴](04-patterns/generative-ai-patterns.md)을 읽는다. 참고 도서와 정확히 같은 기술 스택인지 확인하려면 [도서 목차 반영표](04-patterns/book-coverage.md)를 같이 본다.

## 2. 1단계 — 큰 그림부터 잡기

이 단계에서는 코드를 자세히 읽지 않는다. 먼저 각 부품이 왜 존재하는지 구분한다.

| 순서 | 읽을 문서 | 집중할 질문 | 완료 기준 |
|:---:|---|---|---|
| 1 | [RAG 도입 기준](01-basics/rag-vs-modular-reading.md) | 모든 질문에 RAG가 필요한가? | RAG와 파일 직접 읽기의 선택 기준을 말한다 |
| 2 | [RAG 전체 흐름](01-basics/rag-overall-flow.md) | 임베딩 모델, DB, 생성 LLM은 언제 호출되는가? | AI 1·DB·AI 2의 역할을 섞지 않는다 |
| 3 | [벡터 DB와 임베딩](01-basics/vector-db.md) | 문자열 검색과 의미 검색은 무엇이 다른가? | 벡터·거리·Top-K·ANN을 설명한다 |
| 4 | [임베딩 계보](01-basics/embedding-lineage.md) | Word2Vec에서 문맥 임베딩으로 무엇이 달라졌는가? | 정적 임베딩과 문맥 임베딩을 구분한다 |

여기서 가장 중요한 오해는 “벡터 DB가 문장을 이해한다”는 생각이다. 의미를 숫자로 바꾸는 일은 임베딩 모델이 하고, DB는 이미 만들어진 숫자의 거리를 계산한다. 생성 LLM은 검색 결과로 받은 원문 텍스트를 읽는다.

읽은 뒤 다음 세 질문에 답해 본다.

1. 적재할 때와 검색할 때 임베딩 모델이 같아야 하는 이유는 무엇인가?
2. 벡터 DB 안의 1024개 숫자를 LLM이 직접 읽는가?
3. 정확한 사번이나 에러 코드는 왜 벡터 검색만으로 놓칠 수 있는가?

막히면 [벡터 DB와 임베딩](01-basics/vector-db.md) 1장, 5장을 다시 본다.

## 3. 2단계 — 저장과 검색을 손으로 확인하기

이 단계부터는 문서 하나, 코드 하나, 실행 하나를 묶어서 본다.

| 순서 | 개념 | 먼저 볼 코드 | 실행 |
|:---:|---|---|---|
| 1 | 연결과 컬렉션 | [`chroma.ts`](../src/lib/chroma.ts) | `npm run lec:07-08` |
| 2 | 영속성 | [`09-persistence.ts`](../src/lectures/09-persistence.ts) | `npm run lec:09`을 두 번 실행 |
| 3 | 임베딩 호출 시점 | [`ollama-embedding.ts`](../src/lib/ollama-embedding.ts) | `npm run lec:10` |
| 4 | CRUD와 메타데이터 | [`11-12-basic-crud.ts`](../src/lectures/11-12-basic-crud.ts) | `npm run lec:11-12` |
| 5 | 의미 검색 | [`13-14-similarity-search.ts`](../src/lectures/13-14-similarity-search.ts) | `npm run lec:13-14` |

실행 결과의 1등만 보지 말고 `distance`도 본다. 거리가 작을수록 질문 벡터와 가깝다. 관련 없어 보이는 문서가 상위에 나오면 실패가 아니라 중요한 관찰값이다. 이후 하이브리드 검색과 재랭킹을 붙이는 이유가 여기서 생긴다.

SQLite 방식도 비교하고 싶다면 [SQLite 의미 검색](02-pipeline/sqlite-vector-search.md)을 읽고 다음을 실행한다.

```bash
npm run lab:sqlite
```

Chroma는 ANN과 저장 기능을 감싸 제공한다. SQLite 실습은 모든 벡터를 직접 비교하는 Flat 검색이다. 두 결과가 비슷하더라도 내부 비용은 다르다.

## 4. 3단계 — RAG 파이프라인 조립하기

이제 저장과 검색을 하나의 RAG로 연결한다.

1. [RAG 상세 파이프라인](02-pipeline/rag-pipeline.md)의 오프라인/온라인 구분을 읽는다.
2. [`documents.ts`](../src/lib/documents.ts)에서 청킹→증분 적재 흐름을 본다.
3. [`rag.ts`](../src/lib/rag.ts)에서 검색→컨텍스트 조립→생성 흐름을 본다.
4. `npm run lec:23-24`를 실행한다.

두 파이프라인을 반드시 분리해서 이해한다.

```text
오프라인: 원문 → 파싱 → 청킹 → 임베딩 → 저장
온라인  : 질문 → 임베딩 → 검색 → 컨텍스트 조립 → LLM 답변
```

문서를 한 번 저장해 두고 질문할 때마다 다시 청킹하지 않는 이유, 질문 벡터는 저장하지 않아도 되는 이유를 설명할 수 있으면 다음 단계로 간다.

청킹은 [`15-chunking.ts`](../src/lectures/15-chunking.ts)를 함께 실행한다.

```bash
npm run lec:15
```

고정 길이 청킹은 단순하지만 문맥을 자를 수 있고, 구조 청킹은 제목과 표를 보존하며, 의미 청킹은 문맥 전환점을 찾는 대신 임베딩 비용을 지불한다. “가장 좋은 청킹” 하나가 있는 것이 아니라 문서 구조와 검색 질문에 맞는 선택이 있다.

## 5. 4단계 — 검색 품질을 개선하기

기본 RAG가 실행된 뒤에만 이 단계를 본다. 검색이 틀렸는지 생성이 틀렸는지 구분하지 못한 상태에서 고급 기법부터 붙이면 원인을 찾기 어렵다.

| 문제 | 해결 접근 | 문서·코드 | 실행 |
|---|---|---|---|
| 정확한 문자열을 놓침 | 벡터+문자열 하이브리드 | [`hybrid.ts`](../src/lib/search/hybrid.ts) | `npm run lec:19` |
| 작은 조각은 찾지만 문맥이 부족함 | Parent-Child | [`parent-child.ts`](../src/lib/search/parent-child.ts) | `npm run lec:27` |
| 1차 검색 순서가 거칠음 | 크로스 인코더 재랭킹 | [`rerank.ts`](../src/lib/search/rerank.ts) | `npm run lec:29-30` |
| 질문 표현에 따라 결과가 흔들림 | 재작성·Multi-Query·HyDE | [`rewrite.ts`](../src/lib/search/rewrite.ts) | `npm run lec:31-32` |
| 질문에 정형 조건이 섞임 | Self-Query 필터 | [`self-query.ts`](../src/lib/search/self-query.ts) | `npm run lec:31-32` |

주의할 점은 현재 하이브리드 예제의 키워드 검색이 BM25가 아니라 `$contains` 문자열 포함 검사라는 것이다. 학습 목표는 “서로 다른 검색 신호를 합친다”는 구조를 보는 데 있다.

개선 여부는 느낌이 아니라 같은 평가셋에서 비교한다. [`metrics.ts`](../src/lib/eval/metrics.ts)의 Recall@K, MRR, 지연시간을 함께 본다. 정확도가 올라도 지연시간이 지나치게 늘면 서비스 관점에서는 개선이 아닐 수 있다.

## 6. 5단계 — 신뢰성과 서비스 구조 보기

검색이 맞아도 최종 답이 틀릴 수 있다. 여기서는 생성 결과와 서비스 경계를 공부한다.

1. [`citations.ts`](../src/lib/citations.ts): 실제 자료 번호만 인용했는지 값싸게 검사한다.
2. [`rag.ts`](../src/lib/rag.ts)의 `answerQuestionReliably`: 검사 실패 시 한 번만 다시 쓴다.
3. [`eval/judge.ts`](../src/lib/eval/judge.ts): 답의 근거성과 관련성을 별도 LLM으로 평가한다.
4. [`guardrails.ts`](../src/lib/guardrails.ts): HTTP 입력과 출력 경계에서 위험 신호를 검사한다.
5. [`conversation-store.ts`](../src/sqlite/conversation-store.ts): 대화 기록을 SQLite에 저장한다.

```bash
npm run eval:answer
npm run server
```

인용 검사는 사실 검증이 아니다. `[자료 1]`이 존재하는지는 확인하지만, 그 문장이 정말 자료 1에 들어 있는지는 판단하지 못한다. 그래서 값싼 결정적 검사와 비싼 심판형 LLM 평가를 분리한다.

대화 기록도 전부 프롬프트에 넣지 않는다. 저장은 오래 할 수 있지만 생성에는 최근 턴만 넣어 컨텍스트 크기와 오래된 주제의 간섭을 제한한다.

이 단계가 끝나면 [생성형 AI 설계 패턴](04-patterns/generative-ai-patterns.md)의 32개 반영 지도를 읽는다. 패턴 이름을 외우기보다 어떤 실패를 고치기 위해 선택했는지를 본다.

## 7. 6단계 — 필요한 확장만 선택하기

### GraphRAG

문서 여러 개에 흩어진 인물·조직·사건 관계를 따라가야 할 때 선택한다.

1. [그래프 DB 입문](03-graphrag/graph-db-learning.md) — 노드·관계·Cypher·탐색부터 실습
2. [GraphRAG 설계](03-graphrag/rag-graphdb-hybrid-pipeline.md)
3. [하이브리드 RAG 워크스루](03-graphrag/rag-hybrid-walkthrough.md)
4. [Graph DB 실행 가이드](05-reference/pipelines.md#1-graph-db-neo4j-파이프라인-srcgraph-db)

워크스루는 입문 문서가 아니다. 벡터 검색과 기본 RAG를 실행한 뒤 데이터가 단계별로 어떤 모양으로 바뀌는지 추적할 때 읽는다.

### OCR과 외부 문서

이미지나 스캔 문서를 다룰 때 선택한다.

1. [RAG 상세 파이프라인의 파싱·청킹](02-pipeline/rag-pipeline.md#3-오프라인-파이프라인)
2. [실전 구현과 청킹 전략](02-pipeline/rag-practical-implementation.md)
3. [한글 OCR 실행 가이드](05-reference/pipelines.md#2-한글-ocr-파이프라인-srcocr)

OCR 정확도와 검색 정확도를 따로 측정한다. OCR에서 글자가 잘못 복원되면 뒤의 임베딩과 검색을 아무리 개선해도 원문을 되살릴 수 없다.

### 참고 도서와 비교

[도서 목차 반영표](04-patterns/book-coverage.md)는 공부 순서가 아니라 범위 확인표다. 처음부터 읽기보다 기본 코스를 마친 뒤 “책의 SQLite VSS나 pgvector 실습과 현재 Chroma 구현이 어디서 갈리는가”를 확인할 때 사용한다.

## 8. 막힐 때 찾아볼 문서

| 문서 | 언제 보는가 |
|---|---|
| [LLM 위키](01-basics/llm-wiki.md) | 토큰·컨텍스트 윈도·온도·환각 용어가 막힐 때 |
| [현재 프로젝트 아키텍처](02-pipeline/rag-architecture.md) | 개념이 `src/`의 어느 파일에 있는지 찾을 때 |
| [자바 개발자를 위한 노트](05-reference/자바개발자를-위한-노트.md) | Java/Spring과 TypeScript/Express를 비교할 때 |
| [강의 실습 목록](05-reference/lectures.md) | 실행 명령을 빠르게 찾을 때 |
| [문제 해결](05-reference/troubleshooting.md) | ChromaDB·Ollama·OCR 실행 오류가 날 때 |
| [개념 노트 모음](04-patterns/rag-study-notes.md) | 설계 문서만 모아 보고 싶을 때 |

## 9. 제대로 이해했는지 확인하는 방법

각 실습을 마칠 때 다음 네 줄을 직접 적어 본다.

```text
입력은 무엇이었나?
중간 데이터는 어떤 모양으로 바뀌었나?
출력은 무엇이었나?
이 단계가 실패하면 사용자는 무엇을 보게 되나?
```

예를 들어 의미 검색에서는 입력이 질문 문자열이고, 중간 데이터가 질문 벡터이며, 출력은 거리순 문서 ID다. 이 단계가 실패하면 LLM이 아무리 좋아도 잘못된 자료를 근거로 그럴듯한 답을 만든다.

마지막으로 외부 서비스 없이 빠른 회귀 검사를 실행한다.

```bash
npm run typecheck
npm test
```

테스트가 통과한다는 것은 Ollama 답변 품질이 보장된다는 뜻이 아니다. 벡터 연산, 증분 계획, 대화 저장, 필터 정규화처럼 결정적으로 검증할 수 있는 코드가 깨지지 않았다는 뜻이다.
