# 강의 실습 예제 가이드 (`src/lectures/`)

인프런 강의(7강~32강) 순서와 1:1로 일치하는 실습 스크립트 목록입니다.

---

## 📋 강의별 실행 스크립트 목록

| 회차 | 스크립트 | 소스 파일 | 주요 학습 내용 |
|:---|:---|:---|:---|
| **7~8강** | `npm run lec:07-08` | [`07-08-connection.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/07-08-connection.ts) | ChromaDB 및 Ollama 연결 점검 |
| **9강** | `npm run lec:09` | [`09-persistence.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/09-persistence.ts) | 서버 재시작 후 데이터 영속성 확인 |
| **10강** | `npm run lec:10` | [`10-embedding-timing.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/10-embedding-timing.ts) | 임베딩 함수 자동 호출 시점 검증 |
| **11~12강** | `npm run lec:11-12` | [`11-12-basic-crud.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/11-12-basic-crud.ts) | 기본 CRUD (`add`, `get`, `where`, `update`, `delete`) |
| **13~14강** | `npm run lec:13-14` | [`13-14-similarity-search.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/13-14-similarity-search.ts) | 의미 검색과 코사인 거리 계산 |
| **15강(외)** | `npm run lec:15` | [`15-chunking.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/15-chunking.ts) | 청킹 전략 6종 비교 (Fixed, Structural, Semantic) |
| **19강** | `npm run lec:19` | [`19-hybrid-eval.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/19-hybrid-eval.ts) | 하이브리드 검색(BM25+벡터) + Top-K/MRR 정량 평가 |
| **23~24강** | `npm run lec:23-24` | [`23-24-rag.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/23-24-rag.ts) | RAG 전체 파이프라인 (인제스트 → 검색 → 생성) |
| **29~30강** | `npm run lec:29-30` | [`29-30-rerank.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/29-30-rerank.ts) | 크로스 인코더 2단계 재랭킹 검색 |
| **31~32강** | `npm run lec:31-32` | [`31-32-self-query.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/31-32-self-query.ts) | 질의 재작성 · HyDE · Self-Querying 메타 필터링 |
| **초기화** | `npm run reset` | [`reset.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lectures/reset.ts) | 테스트 컬렉션 초기화 |

*(기존 `npm run ex:01-connection` ~ `ex:10-self-query` 별칭도 그대로 실행 가능합니다)*
