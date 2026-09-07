# RAG 학습 가이드

`docs/`의 모든 문서를 처음부터 끝까지 읽을 필요는 없습니다.

처음 공부할 때는 아래 **핵심 코스**만 순서대로 보고, GraphRAG·OCR·Node/TypeScript 문서는 필요할 때 꺼내 봅니다.

## 문서 지도

```text
RAG가 필요한가?
    ↓
전체 흐름 이해
    ↓
임베딩·벡터 검색 원리
    ↓
오프라인 색인 / 온라인 질의
    ↓
현재 코드와 연결
    ↓
강의 예제로 실행
    ↓
GraphRAG·OCR 등 확장
```

## 1. 핵심 코스

| 순서 | 문서 | 이 문서에서 답하는 질문 | 읽은 뒤 할 일 |
|:---:|:---|:---|:---|
| 0 | [RAG 도입 기준](rag-vs-modular-reading.md) | 내 문제에 RAG가 정말 필요한가? | RAG와 파일 직접 읽기를 구분한다 |
| 1 | [RAG 전체 흐름](rag-overall-flow.md) | AI, 벡터 DB, LLM은 어떤 순서로 움직이는가? | AI 1·DB·AI 2의 역할을 말로 설명한다 |
| 2 | [벡터 DB와 임베딩](vector-db.md) | BGE-M3의 숫자는 무엇이며 DB는 어떻게 찾는가? | 임베딩·거리·ANN·하이브리드 검색을 구분한다 |
| 3 | [RAG 상세 파이프라인](rag-pipeline.md) | 문서 적재와 질문 처리는 왜 분리되는가? | 오프라인/온라인 단계를 직접 그려본다 |
| 4 | [현재 프로젝트 아키텍처](rag-architecture.md) | 위 개념이 `src/`의 어느 코드에 있는가? | 각 단계와 소스 파일을 연결한다 |
| 5 | [강의 실습 예제](lectures.md) | 어떤 명령을 어떤 순서로 실행하는가? | 7~32강 예제를 순서대로 실행한다 |

처음에는 1번부터 시작해도 됩니다. 0번은 “왜 굳이 RAG를 쓰는가”가 궁금할 때 먼저 읽는 짧은 판단 문서입니다.

## 2. 개념과 코드를 연결하는 기준

같은 파이프라인을 서로 다른 관점에서 설명하는 문서가 있습니다. 역할은 다음처럼 구분합니다.

| 문서 | 역할 | 성격 |
|:---|:---|:---|
| [RAG 전체 흐름](rag-overall-flow.md) | 가장 먼저 보는 큰 그림 | 입문 개요 |
| [RAG 상세 파이프라인](rag-pipeline.md) | 오프라인·온라인 단계와 실패 원인 | 개념 기준 문서 |
| [실전 구현과 청킹 전략](rag-practical-implementation.md) | 대안 스택과 설계 선택지 | 보충 자료; 일부는 Python 기준 |
| [현재 프로젝트 아키텍처](rag-architecture.md) | 개념을 이 저장소의 TypeScript 코드에 대응 | 구현 기준 문서 |

따라서 네 문서를 연속해서 정독할 필요는 없습니다. 처음에는 **전체 흐름 → 상세 파이프라인 → 현재 프로젝트 아키텍처**만 읽고, 모델·파서·청킹 도구를 선택할 때 실전 구현 문서를 참고합니다.

## 3. 주제별 심화 코스

### GraphRAG

1. [GraphRAG 설계](rag-graphdb-hybrid-pipeline.md) — 왜 그래프를 붙이는지, 비용과 한계
2. [하이브리드 RAG 워크스루](rag-hybrid-walkthrough.md) — 예제 하나의 데이터 모양을 처음부터 끝까지 추적
3. [Graph DB 실행 가이드](pipelines.md#1-graph-db-neo4j-파이프라인-srcgraph-db) — 현재 코드 실행

GraphRAG 문서는 기본 RAG와 벡터 검색을 이해한 다음 읽습니다. 808줄짜리 워크스루는 입문 문서가 아니라, 설계 문서를 읽고도 데이터 흐름이 모호할 때 사용하는 해설서입니다.

### 문서 처리와 OCR

1. [RAG 상세 파이프라인의 파싱·청킹](rag-pipeline.md#3-오프라인-파이프라인)
2. [실전 구현과 청킹 전략](rag-practical-implementation.md)
3. [한글 OCR 실행 가이드](pipelines.md#2-한글-ocr-파이프라인-srcocr)

### 검색 품질 개선

1. [벡터 검색의 한계와 하이브리드 검색](vector-db.md#5-왜-정확한-문자열에-약한가--하이브리드-검색의-근거-)
2. [강의 실습](lectures.md) 19강 — 검색 평가
3. [강의 실습](lectures.md) 27강 — Parent-Child Retrieval
4. [강의 실습](lectures.md) 29~32강 — 재랭킹, 질의 재작성, HyDE, Self-Query

## 4. 필요할 때 보는 참고 문서

| 문서 | 언제 보는가 |
|:---|:---|
| [LLM 위키](llm-wiki.md) | 토큰·컨텍스트·온도·환각 같은 용어가 막힐 때 또는 위키 코퍼스 실습을 할 때 |
| [자바 개발자를 위한 Node/TypeScript 노트](자바개발자를-위한-노트.md) | Java/Spring과 이 프로젝트의 TypeScript 코드를 비교할 때 |
| [문제 해결](troubleshooting.md) | ChromaDB·OCR 실행 중 오류가 났을 때 |
| [개념 노트 모음](rag-study-notes.md) | 설계 중심 문서만 한 번에 찾고 싶을 때 |

## 5. 추천 학습 방법

각 단계에서 문서를 여러 개 읽기보다 **개념 문서 하나 → 대응 코드 하나 → 실행 한 번**의 순서로 반복합니다.

예를 들어 임베딩을 공부한다면:

1. [벡터 DB와 임베딩](vector-db.md) 1장을 읽는다.
2. [`src/config.ts`](../src/config.ts)에서 현재 모델이 `bge-m3`인지 확인한다.
3. [`src/lib/ollama-embedding.ts`](../src/lib/ollama-embedding.ts)에서 Ollama 호출을 확인한다.
4. `npm run lec:10`으로 임베딩 호출 시점을 실행해 본다.

이 방식으로 읽으면 문서가 별개의 이론 노트가 아니라 실행 코드의 설명서가 됩니다.
