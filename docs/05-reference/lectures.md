# 강의 실습 예제 가이드 (`src/lectures/`)

> 학습 위치: [전체 문서 지도](../README.md) · 이전: [현재 프로젝트 아키텍처](../02-pipeline/rag-architecture.md) · 심화: [GraphRAG 설계](../03-graphrag/rag-graphdb-hybrid-pipeline.md)

인프런 강의(7강~32강) 순서와 1:1로 일치하는 실습 스크립트 목록입니다.

---

## 📋 강의별 실행 스크립트 목록

| 회차 | 스크립트 | 소스 파일 | 주요 학습 내용 |
|:---|:---|:---|:---|
| **7~8강** | `npm run lec:07-08` | [`07-08-connection.ts`](../../src/lectures/07-08-connection.ts) | ChromaDB 및 Ollama 연결 점검 |
| **9강** | `npm run lec:09` | [`09-persistence.ts`](../../src/lectures/09-persistence.ts) | 서버 재시작 후 데이터 영속성 확인 |
| **10강** | `npm run lec:10` | [`10-embedding-timing.ts`](../../src/lectures/10-embedding-timing.ts) | 임베딩 함수 자동 호출 시점 검증 |
| **11~12강** | `npm run lec:11-12` | [`11-12-basic-crud.ts`](../../src/lectures/11-12-basic-crud.ts) | 기본 CRUD (`add`, `get`, `where`, `update`, `delete`) |
| **13~14강** | `npm run lec:13-14` | [`13-14-similarity-search.ts`](../../src/lectures/13-14-similarity-search.ts) | 의미 검색과 코사인 거리 계산 |
| **15강(외)** | `npm run lec:15` | [`15-chunking.ts`](../../src/lectures/15-chunking.ts) | 청킹 전략 6종 비교 (Fixed, Structural, Semantic) |
| **19강** | `npm run lec:19` | [`19-hybrid-eval.ts`](../../src/lectures/19-hybrid-eval.ts) | 벡터+문자열 포함 검색 + Top-K/MRR 정량 평가 |
| **23~24강** | `npm run lec:23-24` | [`23-24-rag.ts`](../../src/lectures/23-24-rag.ts) | RAG 전체 파이프라인 (인제스트 → 검색 → 생성) |
| **27강** | `npm run lec:27` | [`27-parent-child.ts`](../../src/lectures/27-parent-child.ts) | Parent-Child Retrieval (작은 조각으로 찾고 큰 문단으로 답변) |
| **29~30강** | `npm run lec:29-30` | [`29-30-rerank.ts`](../../src/lectures/29-30-rerank.ts) | 크로스 인코더 2단계 재랭킹 검색 |
| **31~32강** | `npm run lec:31-32` | [`31-32-self-query.ts`](../../src/lectures/31-32-self-query.ts) | 질의 재작성 · HyDE · Self-Querying 메타 필터링 |
| **추가 실습** | `npm run lab:sqlite` | [`sqlite-semantic-search.ts`](../../src/lectures/sqlite-semantic-search.ts) | SQLite 정형 필터 + 정확한 Flat 벡터 검색 |
| **초기화** | `npm run reset` | [`reset.ts`](../../src/lectures/reset.ts) | 예제 컬렉션만 초기화 (전체 삭제는 `npm run reset -- --all`) |

> 이 예제의 키워드 검색은 Chroma의 `$contains`를 이용한 문자열 포함 검색입니다.
> 단어 빈도와 문서 길이를 반영해 순위를 계산하는 BM25 구현은 아닙니다.

*(기존 `npm run ex:01-connection` ~ `ex:10-self-query` 별칭도 그대로 실행 가능합니다. 27강은 `ex:12-parent-child` 로도 실행됩니다)*

처음 공부한다면 모든 명령을 한꺼번에 실행하지 말고 [RAG 학습 가이드](../README.md)의 단계별 순서를 따릅니다. 각 예제에서 출력 순위와 거리값을 기록해 두면 이후 하이브리드·재랭킹을 붙였을 때 무엇이 달라졌는지 비교하기 쉽습니다.
