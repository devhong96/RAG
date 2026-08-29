# RAG 아키텍처 및 `src/lib/` 모듈 가이드

이 문서는 프로젝트의 핵심 엔진인 `src/lib/`의 내부 모듈 구성과, 전체 RAG(검색 증강 생성) 파이프라인 흐름을 정리한 문서입니다.

---

## 1. 전체 RAG 파이프라인 데이터 흐름

```text
[문서 원본]
   │
   ▼ 1단계: 문서 쪼개기 (청킹)
   src/lib/chunking/
     • fixed.ts        : 고정 길이 청킹 (글자수/단어수 단위)
     • structural.ts   : 구조 보존 청킹 (마크다운 #, ## 단위)
     • semantic.ts     : 의미 기반 청킹 (문맥이 바뀌는 지점 감지)
   │
   ▼ 2단계: 벡터 변환 & 데이터베이스 저장 (적재)
   src/lib/ollama-embedding.ts : 텍스트 → 1024차원 벡터 변환 (bge-m3 연동)
   src/lib/chroma.ts           : ChromaDB 연결, 컬렉션 생성/초기화 헬퍼
   src/lib/documents.ts        : 청킹 + 임베딩 + 저장을 한 번에 묶은 고수준 서비스
   │
   ▼ 3단계: 똑똑하게 검색하기 (검색 전략)
   src/lib/search/
     • hybrid.ts       : 키워드 검색(BM25/RRF) + 벡터 검색 결합
     • rerank.ts       : 크로스 인코더 2단계 재정렬 (bge-reranker-base)
     • rewrite.ts      : 사용자 질문 다듬기 및 가상 답변(HyDE) 생성
     • self-query.ts   : 질문에서 연도/카테고리 메타데이터 조건 자동 추출
     • parent-child.ts : 검색은 작은 청크로, LLM에는 넓은 부모 문맥 전달
     • graph-rag.ts    : 지식 그래프 관계망과 벡터 문서를 하나로 병합
   │
   ▼ 4단계: 답변 생성 (LLM)
   src/lib/rag.ts      : 검색된 자료로 최종 프롬프트를 조립하는 RAG 파이프라인
   src/lib/llm.ts      : Ollama LLM(채팅 API) 호출 모듈
   │
   ▼ [보조 유틸]
   src/lib/eval/       : 검색 정확도 정량 평가 지표 (MRR, Top-K Hit Rate)
   src/lib/print.ts    : 코사인 거리 계산 및 콘솔 예쁜 출력 헬퍼
   src/lib/graph/      : 지식 그래프(노드, 엣지, 트리플) 기본 자료구조
```

---

## 2. `src/lib/` 단계별 상세 역할

### 1단계: 청킹 (Chunking) — `src/lib/chunking/`
긴 문서를 검색에 적합한 작은 크기로 분할합니다.

* [`fixed.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/chunking/fixed.ts): 글자 수나 단어 수 단위로 단순 분할 (`CharacterSplitter`)
* [`structural.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/chunking/structural.ts): 마크다운 헤더(`#`, `##`, `###`)나 표의 문맥 구조를 유지하며 분할 (`MarkdownSplitter`, `RecursiveSplitter`)
* [`semantic.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/chunking/semantic.ts): 문장 간의 임베딩 유사도를 계산하여 문맥이 바뀌는 지점을 찾아 분할

### 2단계: 임베딩 및 저장 (Ingestion & Storage) — `src/lib/`
분할된 청크를 고차원 벡터로 변환하여 벡터 데이터베이스에 영속화합니다.

* [`ollama-embedding.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/ollama-embedding.ts): Ollama API를 호출해 `bge-m3` 모델로 텍스트를 **1024차원 벡터**로 변환
* [`chroma.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/chroma.ts): ChromaDB 클라이언트 싱글턴 관리, 컬렉션 초기화 및 공통 래퍼 제공
* [`documents.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/documents.ts): 문서 청킹부터 임베딩, 메타데이터 부착, ChromaDB 적재까지 원스톱으로 처리하는 서비스

### 3단계: 고급 검색 전략 (Retrieval & Search) — `src/lib/search/`
단순 벡터 유사도 검색의 한계를 보완하고 정확한 컨텍스트를 추출합니다.

* [`hybrid.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/hybrid.ts): 키워드 검색(BM25/RRF)과 벡터 의미 검색을 결합
* [`rerank.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/rerank.ts): 크로스 인코더(`bge-reranker-base`)로 후보 문서들의 질문 관련도를 정밀 재채점
* [`rewrite.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/rewrite.ts): LLM을 이용해 모호한 질문을 명확하게 다듬거나, 가상 답변을 생성(HyDE)한 후 검색
* [`self-query.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/self-query.ts): 자연어 질문에서 메타데이터 필터 조건(연도, 카테고리 등)을 자동으로 추출하여 메타데이터 필터링 결합
* [`parent-child.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/parent-child.ts): 검색은 정밀한 작은 자식(Child) 청크로 하고, LLM에는 넓은 문맥을 담은 부모(Parent) 문서를 전달
* [`graph-rag.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/search/graph-rag.ts): 지식 그래프(Neo4j/인메모리)의 관계망 Fact와 벡터 문서 청크를 하나의 풀로 통합

### 4단계: 답변 생성 (Generation) — `src/lib/`
추출된 컨텍스트와 사용자 질문을 프롬프트로 결합하여 최종 답변을 생성합니다.

* [`rag.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/rag.ts): 검색된 청크들로 컨텍스트를 구성하고, 프롬프트 템플릿에 주입하여 전체 RAG 실행
* [`llm.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/llm.ts): Ollama 채팅 API (`/api/chat`)를 호출해 LLM으로부터 답변 수신

### 보조 모듈
* [`eval/metrics.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/eval/metrics.ts): Top-K Hit Rate, MRR, 지연시간 등 정량적 검색 성능 평가
* [`print.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/print.ts): 콘솔 결과 출력 및 코사인 거리 계산 유틸
* [`collections.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/collections.ts): 예제가 만드는 컬렉션 이름 목록 (`npm run reset` 이 남의 데이터를 지우지 않도록 삭제 대상을 한정)
* [`graph/knowledge-graph.ts`](file:///Users/hongseho/Desktop/folder/RAG/src/lib/graph/knowledge-graph.ts): 인메모리 엔티티/관계 트리플 기본 자료구조

---

## 3. 외부 폴더와 `lib`의 관계

```text
src/
  ├── lib/               [부품 저장소] 청킹, 임베딩, 검색, LLM 핵심 엔진
  │
  ├── lectures/          [학습 검증] lib의 각 모듈을 강의 순서대로 하나씩 독립 실행/검증
  │                        (예: 15강 -> chunking, 19강 -> search/hybrid, 23~24강 -> rag)
  │
  ├── server/            [서비스화] lib/documents.ts와 lib/rag.ts를 Express REST API로 노출
  │
  ├── graph-db/          [도메인 확장] lib/search/graph-rag.ts 기반 Neo4j 연동 파이프라인
  │
  └── ocr/               [도메인 확장] 이미지 전처리 + 문자 추출 후 lib/documents.ts로 적재
```

---

## 4. 아키텍처 핵심 규칙 요약

1. **임베딩 차원과 LLM의 독립성**:
   * 임베딩 모델(`bge-m3`)의 1024차원 벡터는 ChromaDB 안에서 거리 계산에만 쓰이며, **LLM에게 전달되지 않습니다.**
   * LLM은 검색 결과로 나온 **글자(텍스트)**만 받아 읽고 새로운 글자를 생성합니다.
2. **임베딩 모델과 ChromaDB의 결속성**:
   * 컬렉션 생성 시 지정된 임베딩 차원은 영구 고정됩니다.
   * **적재할 때의 모델과 검색할 때의 모델은 반드시 동일**해야 올바른 거리 계산이 수행됩니다.
