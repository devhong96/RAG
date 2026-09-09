# 참고 도서 목차 반영표

이 문서는 두 참고 도서의 목차와 현재 저장소를 대조하는 기준표다. `구현`은 실행 코드가 있다는 뜻이고, `대체 구현`은 책과 같은 기능을 다른 기술 스택으로 구현했다는 뜻이다.

## 벡터 데이터베이스 실전

| 장 | 상태 | 현재 근거 | 남은 경계 |
|---|---|---|---|
| 1 벡터DB 소개 | 문서화 | [`vector-db.md`](../01-basics/vector-db.md) | SQL·NoSQL 제품별 비교 보강 가능 |
| 2 임베딩 | 문서화+실습 | [`embedding-lineage.md`](../01-basics/embedding-lineage.md), [`vector-math.ts`](../../src/lib/vector-math.ts) | Word2Vec 자체 학습은 범위 밖 |
| 3 FAISS | 개념 반영 | [`vector-db.md`](../01-basics/vector-db.md) 3장 | FAISS 런타임·인덱스 팩토리 실습 없음 |
| 4 SQLite 의미 검색 | 구현 | [`vector-store.ts`](../../src/sqlite/vector-store.ts), `npm run lab:sqlite` | VSS 확장이 아닌 Flat 기준 구현, Reddit 수집기 없음 |
| 5 pgvector 논문 검색 | 대체 구현 | Chroma 인제스트·검색·API | PostgreSQL/pgvector, arXiv, PDF, UI, Docker 패키징 없음 |
| 6 SQLite VSS+Ollama RAG | 대체 구현 | SQLite 저장소 + Ollama + 기존 RAG | SQLite ANN/VSS와 BM25 없음 |
| 7 과학 논문 RAG | 대체 구현 | 고급 청킹, Parent-Child, RAG 파이프라인 | 과학 논문 전용 스키마·arXiv/PDF 없음 |
| 8 대화 검색·RAG | 구현 | 질문 압축, SQLite 대화 기억, Express API | 책의 FastAPI와 UI는 사용하지 않음 |
| 9 벡터 쿼리 언어 | 기초 구현 | [`vector-math.ts`](../../src/lib/vector-math.ts) | 제품별 SQL 연산자·집계 쿼리 없음 |

## 해석 원칙

- Chroma 구현이 있다고 pgvector나 SQLite VSS까지 구현됐다고 표시하지 않는다.
- 문자열 `$contains` 가산점은 BM25가 아니다.
- Flat 검색은 정확한 기준 구현이지만 ANN 인덱스는 아니다.
- 프레임워크가 달라도 학습 목표와 데이터 흐름이 같으면 `대체 구현`으로 표시한다.
