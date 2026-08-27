# chromadb-example

ChromaDB + Ollama(`bge-m3`) 학습용 예제 모음. 강의는 **「실리콘밸리 AI 개발자의 LLM 서비스를 위한 RAG」** (9개 섹션 32강).

## 강의 이력

| 게시일 | 마지막 업데이트일 | 확인한 날 |
|---|---|---|
| 2026-08-14 | 2026-08-14 | 2026-08-27 |

**자막과 자료를 받은 뒤에 강의가 갱신된 적은 없다.** 업데이트일이 게시일과 같다.

## Node/TypeScript 가 처음이라면

자바 백엔드 경험은 있는데 Node 생태계가 낯설다면
[docs/자바개발자를-위한-노트.md](docs/자바개발자를-위한-노트.md) 를 먼저 읽자.
import 경로에 `.js` 를 쓰는 이유, main 메서드가 없는 이유, Express 와 스프링의 대응 관계 등
자바와 다른 지점만 12개로 정리해 두었다.

소스 곳곳에도 `[자바 노트]` 로 시작하는 주석을 달아 두었다.

## 준비물

| 항목 | 확인 | 설치 |
|---|---|---|
| Node 의존성 | `ls node_modules` | `npm install` |
| Chroma CLI | `chroma --version` | `pipx install chromadb` |
| Ollama | `ollama --version` | `brew install ollama` |
| 임베딩 모델 | `ollama list` | `ollama pull bge-m3` |
| 답변 생성 모델 | `ollama list` | `ollama pull llama3.2` |

임베딩 모델(`bge-m3`)은 처음부터 필요하다. 답변 생성 모델(`llama3.2`)은 강의 23 부터,
즉 `ex:08-rag` 이후와 `npm run server` 의 `/ask` 에서 쓴다.

## 실행

### 0. 어느 폴더에서 돌리나

**`npm` 명령은 전부 이 폴더 — `folder/RAG/` — 에서 돌린다.**

```bash
cd ~/Desktop/folder/RAG   # 여기서 시작한다
```

**`dev` 라는 스크립트는 이 프로젝트에 없다.** Express 서버를 띄우는 것은 `npm run server` 다.
(`lectures/` 안의 강의별 스냅샷 몇 개에는 `dev` 가 있지만, 그건 각각 독립된 프로젝트라
그 폴더에서 `npm install` 을 따로 해야 돈다.)

### 1. 서버 두 개를 먼저 띄운다

**Ollama 와 Chroma 가 둘 다 떠 있어야 예제가 돈다.** 서로 의존하지 않으므로 둘 사이의
순서는 상관없지만, 헷갈리면 아래 순서대로 하면 된다. 둘 다 **계속 떠 있어야 하는**
프로세스라 터미널을 하나씩 차지한다.

| | 무엇 | 포트 | 하는 일 |
|---|---|---|---|
| 터미널 1 | Ollama | 11434 | 문장을 벡터로 바꾸고(`bge-m3`), 답변을 생성한다(`llama3.2`) |
| 터미널 2 | Chroma | 8000 | 그 벡터를 저장하고 검색한다 |
| 터미널 3 | 예제 | — | `npm run ex:...` 를 돌리는 곳 |

#### 터미널 1 — Ollama

```bash
ollama serve
```

**이미 떠 있으면 `address already in use` 가 뜬다. 그건 고장이 아니다** — 이미 돌고 있다는
뜻이니 그대로 두면 된다. 미리 확인하려면:

```bash
curl -s localhost:11434     # "Ollama is running" 이 나오면 이미 떠 있다
```

#### 터미널 2 — Chroma

```bash
cd ~/Desktop/folder/RAG   # ← 반드시 이 폴더에서
npm run db
```

**폴더가 중요하다.** `db` 스크립트가 `--path ./chroma-data` 로 **상대 경로**를 쓰기 때문에,
어느 폴더에서 띄우느냐가 곧 어느 DB 를 쓰느냐다. 다른 폴더에서 띄우면 데이터가 갈라지거나
아예 DB 를 못 연다 → 「문제 해결」의 「다른 폴더에서 띄운 Chroma 가 남아 있다」

#### 터미널 3 — 확인

```bash
npm run ex:01-connection
```

두 서버를 한 번에 점검한다. **이렇게 나오면 준비 끝이다.**

```
Chroma  http://localhost:8000  OK  (heartbeat=1787578406189988000)
Ollama  http://localhost:11434  OK  (모델=bge-m3, 차원=1024)

현재 컬렉션 3개: [ ... ]
```

마지막 「현재 컬렉션」 줄까지 나와야 통과다. 그 앞의 `OK` 두 줄만 나오고 `[실패]` 로
끝나면 Chroma 가 엉뚱한 폴더에서 떠 있는 것이다 → 「문제 해결」

### 2. 끄는 법

각 터미널에서 `Ctrl+C`. Chroma 는 껐다 켜도 데이터가 `chroma-data/` 에 남는다.

## 강의 실습 예제 (`src/lectures/`)

인프런 강의 순서(회차 번호)와 1:1로 일치하도록 파일명과 순서가 정렬되어 있습니다.

| 강의 회차 | 스크립트 | 소스 파일 | 내용 |
|---|---|---|---|
| 7~8강 | `npm run lec:07-08` | `07-08-connection.ts` | Chroma/Ollama 연결 점검 |
| 9강 | `npm run lec:09` | `09-persistence.ts` | 서버 재시작 후에도 데이터가 남는가 |
| 10강 | `npm run lec:10` | `10-embedding-timing.ts` | 임베딩 함수 호출 시점 확인 |
| 11~12강 | `npm run lec:11-12` | `11-12-basic-crud.ts` | 기본 CRUD (add / get / where / update / delete) |
| 13~14강 | `npm run lec:13-14` | `13-14-similarity-search.ts` | 의미 검색과 코사인 거리 |
| 15·20·26·27강 | `npm run lec:15` | `15-chunking.ts` | 청킹 전략 6종 비교 (Fixed, Structural, Semantic) |
| 19강 | `npm run lec:19` | `19-hybrid-eval.ts` | 하이브리드 검색 + Top-K/MRR 정량 평가 |
| 22~24강 | `npm run server` | `src/server/index.ts` | Express RAG 백엔드 (:3000) |
| 23~24강 | `npm run lec:23-24` | `23-24-rag.ts` | RAG 전체 파이프라인 (인제스트 → 검색 → 생성) |
| 29~30강 | `npm run lec:29-30` | `29-30-rerank.ts` | 크로스 인코더 2단계 재랭킹 검색 |
| 31~32강 | `npm run lec:31-32` | `31-32-self-query.ts` | 질의 재작성 · HyDE · Self-Querying |
| — | `npm run reset` | `reset.ts` | 모든 컬렉션 초기화 |
| — | `npm run typecheck` | — | 타입 검사 |

*(기존 `npm run ex:01-connection` ~ `ex:10-self-query` 별칭도 호환성을 위해 유지됩니다)*

## Graph DB & OCR 스크립트

| 도메인 | 스크립트 | 소스 파일 | 내용 |
|---|---|---|---|
| **Graph DB** | `npm run graph:seed` | `src/graph-db/seed.ts` | Neo4j 노드/엣지 및 Chroma 청크 적재 |
| **Graph DB** | `npm run graph:search` | `src/graph-db/search.ts` | GraphRAG 다단계 질의 및 답변 생성 |
| **Graph DB** | `npm run graph:status` | `src/graph-db/status.ts` | Neo4j 그래프 노드/관계 현황 조회 |
| **Graph DB** | `npm run graph:in-memory` | `src/graph-db/in-memory.ts` | 경량 인메모리 지식 그래프 실습 |
| **OCR** | `npm run ocr:parse` | `src/ocr/parse.ts` | 이미지 문자 추출 & LLM 마크다운/표 복원 |
| **OCR** | `npm run ocr:search` | `src/ocr/search.ts` | 복원 문서 벡터 적재 & RAG 질의응답 |

## 엔드포인트 (`npm run server`)

| 메서드 | 경로 | 본문 |
|---|---|---|
| GET | `/health` | — |
| POST | `/search` | `{ query, nResults?, where? }` |
| POST | `/documents` | `{ source, text, metadata? }` |
| POST | `/ask` | `{ question, nResults? }` |

## RAG 호출 흐름

**시점이 둘이다.** 문서를 넣어 두는 **적재 시점**과, 질문이 들어왔을 때 도는 **질의 시점**.
벡터를 만드는 임베딩 모델은 양쪽에서 같은 것을 써야 한다 — 넣을 때와 찾을 때가 다른
좌표계면 거리가 뜻을 잃는다.

### 적재 시점 (강의 23)

```
원문 텍스트
  │
  ├─ chunkText(text, 120)                    src/lib/chunking/fixed.ts
  │     └→ 문장 경계(. ! ?)를 지키면서 120자를 넘지 않게 모은 청크 배열
  │
  ├─ collection.delete({ where: { source } }) 같은 source 의 옛 청크를 먼저 지운다
  │
  └─ collection.upsert({ ids, documents, metadatas })
        │   ids = `${source}-chunk-${i}`  (고정 id 라 다시 넣어도 중복 적재가 안 된다)
        │
        └→ documents 를 넘겼으므로 Chroma 가 임베딩 함수를 자동 호출한다 (강의 10)
             OllamaEmbeddingFunction → POST /api/embed (bge-m3, 1024차원)
             컬렉션은 hnsw:space=cosine 으로 만들어 둔다
```

→ 코드: `src/lib/documents.ts` 의 `ingestDocument`, `src/lib/chroma.ts`

### 질의 시점 — 강의 32까지 쌓아 올린 최종 흐름

```
사용자 질문
  │
  ├─ (1) 질의 전처리 ─ 질문 쪽을 손본다. 인덱스는 건드리지 않는다        강의 31~32
  │        rewriteQuery      구어체와 군더더기를 걷어낸다
  │        expandQueries     여러 각도로 변형 → 각각 검색 → rrfMerge 로 합친다
  │        hydeSearch        LLM 에게 가상 답변을 쓰게 하고 그것으로 검색한다
  │        extractFilter     "2024년 이후 커피" → cleanedQuestion + where 필터
  │            └→ 정제된 질의 (+ where)
  │
  ├─ (2) 1단계 검색 ─ 후보를 넓게, 빠르게                              강의 13~14, 19
  │        collection.query({ queryTexts, nResults: candidates })
  │        hybridSearch 로 키워드 가산점을 얹기도 한다
  │            └→ 후보 30개 안팎 (bi-encoder + HNSW)
  │
  ├─ (3) 2단계 재랭킹 ─ 그 후보만 정밀하게 다시 줄 세운다                강의 29~30
  │        rerankScores(질의, 후보 문서들)  cross-encoder
  │        Xenova/bge-reranker-base 를 @xenova/transformers 로 로컬 실행
  │            └→ 점수 내림차순 상위 topK 개 (기본 5)
  │
  ├─ (4) 컨텍스트 조립                                                강의 24, 27, 32
  │        buildContext         [자료 N - 출처: ..., 관련도: 1 - distance]
  │        parentChildSearch    자식으로 찾고 metadata.parentId 로 부모를 꺼낸다
  │        trimContext          LLM 입력 한도에 맞춰 앞에서부터 자른다 (기본 4000자)
  │
  └─ (5) 생성                                                        강의 23~24
           chatComplete(system 규칙 + [자료] + [질문])
           POST /api/chat (llama3.2, temperature 0)
               └→ 답변 + 근거(sources)
```

**두 단계로 나누는 이유.** 임베딩(bi-encoder)은 질의와 문서를 **따로** 벡터로 만들어 비교한다.
미리 계산해 둘 수 있어 빠르지만 정확도에 천장이 있다. 크로스 인코더는 질의와 문서를 **함께**
넣어 관련도를 직접 예측한다. 정확한 대신 후보 수만큼 추론을 돌려야 해서 느리다.
그래서 **넓게 뽑는 일은 1단계에, 정밀하게 고르는 일은 2단계에** 맡긴다.

### 단계별 코드와 현재 배선

| | 단계 | 코드 | 강의 | `/ask` 가 지금 태우나 |
|---|---|---|---|---|
| 1 | 질의 전처리 | `lib/search/rewrite.ts`, `lib/search/self-query.ts` | 31~32 | 아니오 — `ex:10-self-query` |
| 2 | 1단계 검색 | `lib/documents.ts` `searchDocuments`, `lib/search/hybrid.ts` | 13~14, 19 | 예 (`nResults` 기본 3) |
| 3 | 2단계 재랭킹 | `lib/search/rerank.ts` `searchWithRerank` | 29~30 | 아니오 — `ex:09-rerank` |
| 4 | 컨텍스트 조립 | `lib/rag.ts` `buildContext`, `lib/search/parent-child.ts` | 24, 27, 32 | 일부 (`buildContext` 만) |
| 5 | 생성 | `lib/rag.ts` `buildMessages`, `lib/llm.ts` | 23~24 | 예 |

**`POST /ask` 는 아직 최소 RAG 다.** 강의 23~24 에서 만든 「검색 → 컨텍스트 → 생성」 세 단계만
돈다. 재랭킹과 질의 재작성은 강의 29 이후에 붙은 것이라 `lib/search/` 에 모듈로만 있고,
각각 `npm run ex:09-rerank` 와 `npm run ex:10-self-query` 에서 단독으로 확인한다.

```
POST /ask { question, nResults }
  → answerQuestion(question, nResults ?? 3)      src/lib/rag.ts
      → searchDocuments("rag-docs", question, n) src/lib/documents.ts
      → buildContext(sources)
      → chatComplete(buildMessages(...))         src/lib/llm.ts
  ← { question, answer, sources: [{ source, excerpt, distance }] }
```

### 후보 수(`candidates`)를 어떻게 정하나 (강의 30)

Chroma 검색은 HNSW 인덱스 덕분에 후보가 30개든 100개든 크게 느려지지 않는다.
**느린 쪽은 언제나 2단계** — 크로스 인코더가 후보마다 추론을 돌리기 때문이다.
그래서 균형은 체감 응답 시간에서 거꾸로 잡는다.

```
2단계에 쓸 수 있는 시간 = 목표 응답 시간 − 1단계 검색 시간 − 그 외 오버헤드
```

1단계 시간은 측정할 수 있으니, 남은 시간 안에서 가장 큰 후보 수를 고르면 된다.
문서가 수천 개 규모면 30~50 이 자연스럽다. `searchWithRerank` 의 기본값이 `candidates = 30`,
`topK = 5` 인 이유다.

**재랭킹을 항상 켤 필요는 없다.** 강의의 예제 데이터셋(문서 10개)에서는 순수 벡터 검색도
Recall@5 100%, MRR 1 이 나와서 재랭킹과 차이가 없었다. 그건 크로스 인코더가 쓸모없다는
뜻이 아니라 **이 정도 크기에서는 bi-encoder 만으로 충분하다**는 뜻이다. 도입 여부는
평가셋으로 재보고 정한다. 이 저장소의 `npm run ex:09-rerank` 는 문서 8개로 같은 비교를
돌리고, 지표 계산은 `lib/eval/metrics.ts` 에 있다 (`npm run ex:07-hybrid-eval` 도 같은 것을 쓴다).

> **[강의 밖 보충]** 위 (1)~(5) 를 한 함수로 묶어 놓은 코드는 이 저장소에 없다.
> 강의가 각 기법을 독립된 모듈로 두고 예제에서 하나씩 확인하는 형태로 진행했기 때문이다.
> 실제로 이어 붙일 때는 (3) 의 `searchWithRerank` 가 돌려주는 `id` 로 원문과 메타데이터를
> 다시 `get` 해야 한다 — 그 함수는 `include: ["documents"]` 만 받아 오므로 결과에
> `distance` 와 `metadata` 가 없고, `buildContext` 가 쓰는 관련도 표시가 그대로는 안 맞는다.

## Graph DB & OCR 파이프라인

단순 청킹과 단일 벡터 검색의 한계를 보완하기 위한 확장 파이프라인이다.

---

### 1. Graph DB (Neo4j) + GraphRAG (`src/graph-db/`)

순수 벡터 검색(Bi-Encoder)은 개별 청크 단위의 의미적 유사도만 본다. 따라서 **"A -> B -> C"** 처럼 여러 문서 조각에 걸쳐 파편화된 **다단계 관계(Multi-hop)**를 질의할 때 중요한 중간 다리 청크를 놓치기 쉽다.

Neo4j는 개체(Node)와 관계(Edge)를 트리플(주어-술어-목적어) 형태로 영속화하고, Cypher 쿼리를 통해 n-hop 관계망을 찾아내어 벡터 검색 후보와 결합한 후 크로스 인코더로 정밀 재정렬한다.

```
사용자 복합 질문
  │
  ├─ (1) Chroma 벡터 검색 ────> 의미적 유사 본문 청크 후보 수집
  │
  ├─ (2) Neo4j Cypher 탐색 ───> 질문 내 엔티티 기준 n-hop 관계(트리플 Fact) 탐색
  │                              MATCH path = (start:Entity)-[*1..2]-(target:Entity)
  │
  ├─ (3) 후보군 통합 ─────────> [문서 청크] + [지식 그래프 Fact] 하나의 풀로 병합
  │
  ├─ (4) 2단계 재랭킹 ────────> 크로스 인코더(BGE-Reranker)로 질문 관련도 정밀 채점
  │                              점수 내림차순 상위 Top-K 추출
  │
  └─ (5) LLM 생성 ────────────> 지식 관계망과 문서 본문이 융합된 프롬프트로 최종 답변
```

* **분리된 전용 스크립트**:
  * `npm run graph:seed` (`src/graph-db/seed.ts`) — Neo4j 노드/엣지 및 Chroma 벡터 청크 적재
  * `npm run graph:search` (`src/graph-db/search.ts`) — GraphRAG 다단계 질의 및 답변 생성
  * `npm run graph:status` (`src/graph-db/status.ts`) — 현재 저장된 노드/관계 통계 및 엔티티 목록 조회
* **모듈 코드**:
  * `src/graph-db/client.ts` — `neo4j-driver` 기반 지식 그래프 클라이언트 (Cypher `MERGE`/`MATCH`)
  * `src/graph-db/search-engine.ts` — 벡터 검색과 그래프 탐색 결과 통합 및 크로스 인코더 리랭킹
* **Neo4j Docker 구동 및 브라우저 시각화**:
  ```bash
  # 컨테이너 실행 (최초 1회)
  docker run -d --name neo4j-rag -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password123! neo4j:5
  ```
  * 웹 브라우저에서 `http://localhost:7474` 접속 (계정: `neo4j`, 비밀번호: `password123!`)
  * Cypher 입력창에 `MATCH (n) RETURN n` 을 실행하면 저장된 엔티티 관계망을 그래픽으로 즉시 확인 가능

---

### 2. 한글 OCR + 지능형 문서/표 복원 파이프라인 (`src/ocr/`)

사내 지식베이스(위키, 사규, 기술 규격서, 계약서)는 텍스트 파일이 아니라 **스캔된 PDF나 이미지(표/서식 포함)**로 존재하는 경우가 많다. 원시 OCR(Raw OCR)을 그대로 벡터 DB에 넣으면 오탈자(예: `AI` -> `시`, `DLC` -> `ㅁㄴ`)와 표 깨짐으로 인해 임베딩 유사도가 크게 훼손된다 (Garbage In, Garbage Out).

이를 방지하기 위해 **"이미지 전처리 -> OCR -> LLM 마크다운/표 구조 복원 -> 시맨틱 청킹 -> 벡터 DB"** 4단계 파이프라인을 거친다.

```
스캔/문서 이미지 (PNG/JPG)
  │
  ├─ (1) 이미지 전처리 (sharp)
  │        그레이스케일 변환, 대비(Contrast) 정규화, 선명화(Sharpening)로 문자 경계 강화
  │
  ├─ (2) 이중 언어 OCR (Tesseract.js)
  │        한국어(kor) + 영어(eng) 광학 문자 인식
  │        └→ 원시 텍스트 추출 (문자 깨짐 및 표 붕괴 상태)
  │
  ├─ (3) LLM 마크다운/표 구조 복원 (Llama 3.2)
  │        문맥 기반 오탈자 자동 보정, 마크다운 표(| 헤더1 | 헤더2 |) 및 불릿 구조 복구
  │        └→ 깨끗하게 정제된 고품질 마크다운 본문
  │
  ├─ (4) 구조 보존 청킹 (RecursiveCharacterTextSplitter)
  │        마크다운 헤더(#, ##, ###) 및 표 단위를 인식하여 의미 단위로 분할
  │
  └─ (5) Chroma 벡터 DB 적재 및 질의응답 (RAG)
           출처(source), 청크 인덱스 메타데이터와 함께 적재 후 유사도 검색 및 답변 생성
```

* **분리된 전용 스크립트**:
  * `npm run ocr:parse` (`src/ocr/parse.ts`) — 이미지 문자 추출 및 LLM 마크다운/표 복원 단독 확인 (결과를 `scanned-doc-restored.md`로 저장)
  * `npm run ocr:search` (`src/ocr/search.ts`) — 복원된 문서를 청킹하여 Chroma에 적재하고 질문에 대해 RAG 답변 생성
* **모듈 코드**:
  * `src/ocr/engine.ts` — `sharp` 전처리 및 `Tesseract.js` 한/영 OCR 엔진
  * `src/ocr/pipeline.ts` — LLM 마크다운 정제 + 시맨틱 청킹 + ChromaDB 적재 파이프라인
  * `src/ocr/sample-doc.ts` — 실습용 300DPI 고해상도 규격서 스캔 이미지 생성기

---

## 구조

```
src/
  config.ts                  설정 한곳에 (환경변수로 덮어쓰기 가능)
  data/                      예제용 문서
  lectures/                  인프런 강의 실습 예제 (회차 번호와 1:1 일치)
    07-08-connection.ts ~ 31-32-self-query.ts, reset.ts
  graph-db/                  Graph DB (Neo4j) 클라이언트 및 스크립트
    client.ts                Neo4j 지식 그래프 클라이언트 (Cypher)
    search-engine.ts         GraphRAG 결합 검색 엔진
    seed.ts                  [스크립트] 노드/관계 및 청크 적재 (npm run graph:seed)
    search.ts                [스크립트] GraphRAG 질의/검색 (npm run graph:search)
    status.ts                [스크립트] 그래프 현황/통계 (npm run graph:status)
    in-memory.ts             인메모리 지식 그래프 실습 (npm run graph:in-memory)
  ocr/                       한글 OCR & 문서 파싱
    engine.ts                sharp 전처리 + Tesseract.js 한/영 OCR 엔진
    pipeline.ts              LLM 마크다운 정제 + 시맨틱 청킹 + ChromaDB 적재
    sample-doc.ts            실습용 고해상도 규격서 이미지 생성기
    parse.ts                 [스크립트] 이미지 -> OCR -> LLM 마크다운 복원 (npm run ocr:parse)
    search.ts                [스크립트] 복원 문서 벡터 적재 & 질의응답 (npm run ocr:search)
  lib/
    chroma.ts                공용 클라이언트 · 컬렉션 헬퍼 · 실행 래퍼
    ollama-embedding.ts      EmbeddingFunction 구현
    llm.ts                   Ollama 채팅 (temperature 기본 0)
    print.ts                 결과 출력 · 코사인 거리
    documents.ts             인제스트 · 검색 서비스
    rag.ts                   RAG 파이프라인 + 프롬프트
    chunking/                fixed · structural · semantic
    search/                  hybrid · rerank · rewrite · self-query · parent-child
    eval/                    Top-K · MRR · 지연시간
    graph/                   지식 그래프 (인메모리 & Neo4j re-export)
  server/                    Express 앱 (강의 22~24)
  index.ts                   스크래치 (npm start)
chroma-data/                 Chroma SQLite (git 제외)
docs/
  toc/curriculum.md          강의 목차 + 진행 현황판
  script/{번호}-{제목}.md      대본 — 자막을 줄글로 옮긴 것
  note/{번호}-{제목}.md        노트 — 읽으라고 쓰는 것
  summary/{번호}-{제목}.md     요약 — 아직 없다
  자바개발자를-위한-노트.md      Node 생태계가 낯설 때 먼저 읽는 것
lectures/                    강의 코드 스냅샷 (코드가 있는 회차만)
  {번호}-{제목}/
    src/                     그 강의 시점의 코드 (9강부터)
local/                       강의가 준 것. 읽기만 한다
  script/                    원본 자막 드롭존
  script-draft/              회차 대본 초벌 (기계 산출)
  자료/                       강의 첨부 슬라이드 PNG (3~7강)
```

**`local/` 안도 커밋된다** (2026-08-25 정책 변경). `local/` 은 커밋 경계가 아니라
**「받은 것」과 「만든 것」의 경계**다. 안쪽은 손대지 않는 원본이고, `docs/` 와 `lectures/` 가 우리가 만든 것이다.
강의가 판매하는 자료가 들어 있으므로 **저장소를 공개로 바꾸지 않는다.**

## 강의 코드와 대본

**2026-08-27 에 대본과 노트를 `docs/` 로 옮겼다.** 예전에는 `lectures/{회차}/강의대본.md` 와 `강의노트.md` 였다. 지금은 회차마다 `docs/script/`, `docs/note/`, `docs/summary/` 에 **같은 이름으로** 하나씩 둔다. **코드는 `lectures/` 에 그대로 뒀다** — 규칙이 「강의별 스냅샷이면 `lectures/`」를 코드 폴더 이름으로 인정한다.

**코드가 없는 회차는 `lectures/` 에 폴더가 없다.** 3~8, 17, 25강이 그렇다.

**요약 30개가 아직 없다.** 어디까지 진행됐는지는 [docs/toc/curriculum.md](docs/toc/curriculum.md) 가 기준이고, 남은 것은 저장소 루트의 `남은-작업.md` 에 있다.

코드 스냅샷의 목차와 주의사항은 [lectures/README.md](lectures/README.md) 참고.

`lectures/` 는 각 강의 시점의 독립 프로젝트라 이 프로젝트의 `src/` 와 섞이지 않는다.
`tsconfig.json` 의 `include` 도 `src` 만 보므로 타입 검사에도 끌려오지 않는다.

## 환경변수

코드를 고치지 않고 바꿀 수 있다.

```bash
CHROMA_URL=http://localhost:8000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=bge-m3
NEO4J_URL=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123!
```

## 개념 메모

### bge-m3

BAAI 에서 공개한 다국어 임베딩 모델. 한국어를 포함해 여러 언어를 잘 다루도록
미리 학습되어 있다. 출력 벡터는 1024 차원.

### pipx

Python 으로 작성된 CLI 도구를 격리된 환경에 설치해준다.

### id 는 기본키다

`add` 할 때 넘기는 `ids` 는 기본키다. 같은 id 로 여러 번 add 해도 문서 수는
늘지 않는다. 그래서 id 를 고정해둔 채 `count()` 를 찍으면 몇 번을 실행하든 1 이
나오고, **영속성이 되는지 안 되는지 구분할 수 없다.** `04-persistence` 예제가
매번 새 id 를 쓰는 이유다.

### 임베딩 함수 호출 시점

- `documents` / `queryTexts` 를 넘기면 → 임베딩 함수가 자동 호출된다
- `embeddings` / `queryEmbeddings` 를 넘기면 → 임베딩 함수는 호출되지 않는다

## 문제 해결

### 다른 폴더에서 띄운 Chroma 가 남아 있다

`ex:01-connection` 이 **heartbeat 는 OK 인데 그다음 줄에서 실패**하면 이 경우다.

```
Chroma  http://localhost:8000  OK  (heartbeat=...)
Ollama  http://localhost:11434  OK  (모델=bge-m3, 차원=1024)

[실패] Database error: error returned from database: (code: 14) unable to open database file
```

`npm run db` 는 `--path ./chroma-data` 로 **상대 경로**를 쓴다. 그래서 서버가 어느 폴더에서
떠 있느냐가 곧 어느 DB 를 여느냐다. 예전에 다른 폴더에서 띄워둔 서버가 아직 살아 있으면
포트 8000 을 그쪽이 잡고 있으므로 **heartbeat 는 멀쩡히 응답하는데 DB 는 못 연다.**
그 폴더를 옮겼거나 지웠으면 확실히 이렇게 된다.

어느 폴더에서 떠 있는지부터 확인한다.

```bash
pgrep -f "chroma run"            # PID 를 얻고
lsof -a -p <PID> -d cwd          # 그 PID 의 작업 폴더를 본다
```

`folder/RAG` 가 아니면 죽이고 이 폴더에서 다시 띄운다.

```bash
pkill -f "chroma run"
cd ~/Desktop/folder/RAG && npm run db
```

### 서버가 두 개 뜬다

macOS 에서는 `chroma run` 을 두 번 실행하면 포트 충돌 에러 없이 하나는 IPv4,
하나는 IPv6 에 각각 붙는다. 서로 다른 DB 를 보게 되어 데이터가 갈라진다.
띄우기 전에 확인할 것.

```bash
pgrep -fl "chroma run"
```

### `npm run db` 가 쓰는 바이너리

npm 은 `node_modules/.bin` 을 PATH 앞에 붙이는데, `chromadb` 패키지에도 `chroma`
CLI 가 들어 있다. 이쪽은 SIGTERM/SIGINT 를 무시해서 Ctrl+C 로 안 꺼진다.
그래서 `db` 스크립트는 `node_modules` 가 아닌 `chroma` 를 골라 쓴다.

```json
"db": "C=$(which -a chroma | grep -v node_modules | head -1); ${C:-chroma} run --path ./chroma-data"
```

### 데이터를 처음부터 다시

```bash
npm run reset          # 컬렉션만 삭제
rm -rf chroma-data     # DB 파일째 삭제 (서버 종료 후)
```

---

## 대본 초벌 (`local/script-draft/`)

**⚠ 완성된 대본이 아니다.** 자막 원본에서 기계로 만든 중간 산출물이고, `local/` 안에 있다 — **2026-08-25 부터 `local/` 도 저장소에 커밋된다.** **30회차** 전부 들어 있다 — 이미 완성된 대본이 있는 **30회차도 포함**한다. **완성본이 있으면 그쪽이 기준이고 초벌로 덮어쓰지 않는다**.

**기계가 해 둔 것** — 자막 큐 잇기, 30초 안팎으로 문단 나누기, 문단 첫 큐 시각 붙이기. 이 셋은 판단이 안 들어가는 일이라 전수 검사로 보장된다.

```
20초미만 간격  0%              ← 문단 간격 규칙
낱말 보존      원본과 완전 동일   ← 한 글자도 새지 않는다
시각           원본 큐 값 그대로   ← 지어낼 여지가 없다
```

**반드시 사람이 해야 하는 것.** 이걸 건너뛰고 `docs/script/` 로 옮기면 규칙 위반이다.

1. **표기 교정** — 자막이 잘못 받아쓴 낱말을 바로잡는다. 뜻을 추론해 고치지 않고, **애매하면 원본대로 둔다**
2. **문장부호** — 초벌에는 자막에 있던 것만 있다. 대부분의 문장이 마침표 없이 이어져 있다
3. **머리말** — `docs/script/` 대본 머리에 붙는 안내 한 줄
4. **문단 경계** — 기계는 종결 어미와 30초 규칙으로만 끊는다. 화제가 바뀌는 자리와 어긋나면 `**[시각]**` 줄을 옮기거나 지운다. **값은 원본 큐에서 다시 확인한다**

**초벌은 언제든 다시 만든다.** 원본 자막만 있으면 되므로 지워도 잃는 것이 없다.

---
