# RAG Study & Pipeline Playground

ChromaDB, Ollama, Neo4j, OCR 기반의 **검색 증강 생성(RAG)** 학습 및 파이프라인 실습 저장소입니다.

---

## 📚 학습 시작하기

문서가 주제별로 나뉘어 있으므로 파일 목록 순서대로 읽지 마세요.

처음 공부한다면 [**RAG 학습 가이드**](docs/README.md)의 **입문 → 원리 → 구현 → 실습** 순서를 따라갑니다.

빠른 진입점:

* 🗺️ [**전체 학습 순서와 문서 지도**](docs/README.md)
* 🧭 [**현재 코드 아키텍처**](docs/rag-architecture.md)
* 🎓 [**강의 실습 순서**](docs/lectures.md)
* 🔧 [**문제 해결**](docs/troubleshooting.md)

---

## 🚀 빠른 시작 (Quick Start)

### 1. 사전 환경 구성
```bash
npm install               # 의존성 설치
pipx install chromadb     # Chroma CLI 설치 (없는 경우)
ollama pull bge-m3        # 1024차원 한국어 임베딩 모델
```

### 2. 백엔드 서비스 실행
```bash
# 터미널 1: Ollama 서버
ollama serve

# 터미널 2: ChromaDB (포트 8000)
npm run db

# 터미널 3: Neo4j 그래프 DB (Docker)
docker run -d --name neo4j-rag -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password123! neo4j:5
```

### 3. 연결 점검
```bash
npm run lec:07-08
```

---

## ⚡ 주요 실행 스크립트 요약

| 구분 | 주요 명령어 | 설명 |
|:---|:---|:---|
| **강의 실습** | `npm run lec:07-08` ~ `lec:31-32` | 7강부터 32강까지 순차 실습 ([전체 목록](docs/lectures.md)) |
| **Graph DB** | `npm run graph:seed`<br>`npm run graph:search` | Neo4j 데이터 적재 및 GraphRAG 질의 ([상세 가이드](docs/pipelines.md)) |
| **LLM 위키** | `npm run wiki:ingest`<br>`npm run wiki:search` | 위키백과 문서 적재 및 RAG 질의 ([상세 가이드](docs/llm-wiki.md)) |
| **한글 OCR** | `npm run ocr:parse`<br>`npm run ocr:search` | 문서 이미지 텍스트/표 복원 및 RAG 질의 ([상세 가이드](docs/pipelines.md)) |
| **대화형 RAG** | `npm run chat` | 이전 질문을 기억하는 멀티턴 RAG CLI (`/new`, `/exit`) |
| **API 서버** | `npm run server` | Express REST API 서버 구동 (`:3000`) |
| **로컬 테스트** | `npm test` | 외부 서비스 없이 청킹·검색 보조 로직·평가 지표 검증 |
| **타입 검사** | `npm run typecheck` | TypeScript 정적 타입 검사 |
| **초기화** | `npm run reset` | 테스트 컬렉션 데이터 초기화 |

---

## 📂 프로젝트 구조

```text
src/
  ├── config.ts         # 통합 환경 설정 (Chroma, Ollama, Neo4j)
  ├── chat.ts           # 멀티턴 대화 RAG CLI 데모
  ├── lectures/         # 인프런 강의 실습 예제 (회차 번호와 1:1 일치)
  ├── graph-db/         # Neo4j 지식 그래프 클라이언트 및 스크립트
  ├── ocr/              # 한글 OCR 엔진 및 문서/표 복원 파이프라인
  ├── wiki/             # 위키백과 문서 수집 → 구조 청킹 → RAG 파이프라인
  ├── lib/              # RAG 핵심 공통 모듈 (청킹, 검색, 임베딩, LLM)
  │     ├── incremental.ts    # 증분 인덱싱 (바뀐 청크만 재임베딩)
  │     └── conversation.ts   # 대화 기록 관리 + 질문 압축
  └── server/           # Express REST API 백엔드
docs/                   # 주제별 상세 기술 문서
```

---

## 🗒️ 최근 변경 내역

참고 도서(*벡터 데이터베이스 실전*) 목차와 코드를 대조해 비어 있던 주제를 채운 작업입니다.

| 주제 | 내용 | 관련 위치 |
|:---|:---|:---|
| **증분 인덱싱** | 같은 문서를 다시 넣을 때 내용 지문(sha256)을 비교해 **바뀐 청크만 재임베딩**합니다. 서버 인제스트·위키·OCR 파이프라인에 모두 적용했고, `POST /documents` 응답과 스크립트 로그에 `변경/건너뜀/삭제` 수가 찍힙니다. | `src/lib/incremental.ts` |
| **멀티턴 대화 RAG** | 이전 대화를 참고해 후속 질문("그거 왜 필요한데요?")을 독립 질의로 다시 쓴 뒤 검색합니다. **검색에는 압축한 질의, 생성에는 원래 질문과 대화 기록**을 씁니다. `POST /ask` 에 `sessionId` 를 넣으면 대화형으로, 없으면 기존 단발 동작 그대로 동작합니다. | `src/lib/conversation.ts`, `npm run chat` |
| **ANN 인덱스·양자화 문서** | Flat / IVF / HNSW 세 계열과 재현율↔속도 다이얼(`nprobe`, `ef_search`), SQ·BQ·PQ 양자화를 정리했습니다. Chroma 가 무엇을 대신 정해주고 있는지도 함께 적었습니다. | [docs/vector-db.md](docs/vector-db.md) 3-1~3-3절 |

> 도서 목차 대비 아직 다루지 않는 주제: SQLite/PostgreSQL 위에서의 벡터 검색(pgvector), Word2Vec에서 트랜스포머로 이어지는 임베딩 계보.
