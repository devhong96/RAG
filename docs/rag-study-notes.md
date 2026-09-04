# 📖 RAG 공부 노트

이 저장소를 만들면서 정리한 RAG 개념 노트 모음입니다.
실행 코드(`src/`)와 실습 가이드(`docs/`)와 달리, **왜 이렇게 설계하는가**를 다룹니다.

원본은 `cs-study/ai/`에서 관리하며, 여기로 복사해 함께 봅니다.

## 읽는 순서

1. [RAG 도입 기준과 모듈형 지식 주입](rag-vs-modular-reading.md) — 애초에 RAG가 필요한가부터
2. [RAG 파이프라인 (오프라인 인덱싱 + 온라인 질의)](rag-pipeline.md) — 전체 구조의 기준 문서
3. [RAG 파이프라인 7단계 흐름 (개발자 관점)](rag-overall-flow.md) — 내 코드가 무엇을 언제 호출하는가
4. [벡터DB (임베딩 · ANN 인덱스 · 하이브리드 검색)](vector-db.md) — 저장/검색 계층의 원리
5. [RAG 실전 구현과 청킹 전략](rag-practical-implementation.md) — 스택 선택과 문서 자르기
6. [GraphRAG — 그래프 DB를 붙인 RAG](rag-graphdb-hybrid-pipeline.md) — 벡터가 못 잡는 구조적 연결
7. [하이브리드 RAG 워크스루](rag-hybrid-walkthrough.md) — 단계마다 데이터가 실제로 어떻게 변형되는지 끝까지 추적

## 코드와의 연결

- 파이프라인 구현: [`rag-architecture.md`](rag-architecture.md)
- 그래프/OCR 파이프라인: [`pipelines.md`](pipelines.md)
- 용어 사전: [`llm-wiki.md`](llm-wiki.md)
