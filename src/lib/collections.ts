import { RAG_COLLECTION } from "./rag.js"

/**
 * 이 저장소의 예제들이 만드는 컬렉션 이름 목록.
 *
 * [초보자 설명] 왜 목록을 따로 두는가?
 * `npm run reset` 은 예전에 Chroma 서버에 있는 컬렉션을 "전부" 지웠다.
 * 하지만 Chroma 서버 하나를 여러 프로젝트가 같이 쓰는 경우가 흔하다.
 * 그러면 이 강의와 아무 상관 없는 남의 데이터까지 날아간다.
 * 그래서 "우리가 만든 것"의 이름을 여기에 적어두고, 그 목록에 있는 것만 지운다.
 *
 * 새 예제를 추가해서 새 컬렉션을 만들었다면 여기에도 이름을 추가하자.
 * (빠뜨려도 데이터가 지워지지 않을 뿐이라 안전하다. reset 이 "목록에 없어서 남겨둔
 *  컬렉션"을 화면에 알려주므로, 빠뜨린 것을 바로 눈치챌 수 있다.)
 */
export const EXAMPLE_COLLECTIONS: readonly string[] = [
  "scratch", // src/index.ts (자유 실습)
  "persistence", // 09강 영속성
  "embedding-timing", // 10강 임베딩 호출 시점
  "basic-crud", // 11~12강 CRUD
  "similarity-search", // 13~14강 유사도 검색
  "hybrid-eval", // 19강 하이브리드 검색 + 평가
  RAG_COLLECTION, // 23~24강 RAG ("rag-docs") — 서버도 이 컬렉션을 쓴다
  "rerank-articles", // 29~30강 재랭킹
  "rag-with-meta", // 31~32강 Self-Query
  "parent-store", // 27강 Parent-Child (부모 문단 보관)
  "parent-child", // 27강 Parent-Child (검색용 자식 조각)
  "graph-rag-demo", // 인메모리 GraphRAG
  "neo4j-graph-rag-demo", // Neo4j GraphRAG
  "ocr-documents-demo", // OCR 파이프라인
  "llm-wiki", // 위키백과(LLM 주제) 인제스트/질의 파이프라인
]
