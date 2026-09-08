# RAG 개념·설계 노트 모음

이 저장소를 만들면서 정리한 RAG 개념 노트 모음입니다.
실행 코드와 사용법보다 **왜 이렇게 설계하는가**를 다룹니다.

원본은 `cs-study/ai/`에서 관리하며, 여기로 복사해 함께 봅니다.

> 전체 문서를 공부하는 순서는 [RAG 학습 가이드](README.md)를 기준으로 합니다. 이 페이지는 그중 **개념·설계 노트만 모은 색인**입니다.

## 기본 개념

1. [RAG 도입 기준과 모듈형 지식 주입](rag-vs-modular-reading.md) — 애초에 RAG가 필요한가부터
2. [RAG 파이프라인 7단계 흐름](rag-overall-flow.md) — 내 코드가 무엇을 언제 호출하는가
3. [벡터DB](vector-db.md) — 임베딩·거리·ANN·하이브리드 검색의 원리
4. [RAG 파이프라인](rag-pipeline.md) — 오프라인 인덱싱과 온라인 질의의 기준 문서

## 설계 보충

- [RAG 실전 구현과 청킹 전략](rag-practical-implementation.md) — 대안 스택과 문서 자르기; 일부는 Python 기준
- [그래프 DB 입문](graph-db-learning.md) — 속성 그래프 모델, Cypher, 탐색과 Neo4j 실습
- [GraphRAG 설계](rag-graphdb-hybrid-pipeline.md) — 벡터가 못 잡는 구조적 연결
- [하이브리드 RAG 워크스루](rag-hybrid-walkthrough.md) — GraphRAG의 데이터를 단계별로 추적하는 장문 해설
- [생성형 AI 설계 패턴, 무엇을 골라 넣었나](generative-ai-patterns.md) — 패턴 32개의 구현·부분 적용·미구현 경계와 선택 이유

## 코드와의 연결

- 현재 TypeScript 구현: [프로젝트 아키텍처](rag-architecture.md)
- 실행 순서: [강의 실습 예제](lectures.md)
- Graph DB/OCR 실행: [파이프라인 가이드](pipelines.md)
