# RAG Study & Pipeline Playground

ChromaDB, Ollama, Neo4j, OCR 기반의 **검색 증강 생성(RAG)** 학습 및 파이프라인 실습 저장소입니다.

---

## 📚 상세 문서 목록

상세한 아키텍처 흐름과 단계별 설명은 `docs/`에 주제별로 분리되어 있습니다:

* 🧭 [**RAG 아키텍처 및 lib 모듈 가이드**](docs/rag-architecture.md): 4단계 파이프라인 흐름 및 `src/lib/` 내부 구조
* 🎓 [**강의 실습 예제 가이드**](docs/lectures.md): 07강부터 32강까지 회차별 실습 스크립트 전체 목록
* 🧠 [**LLM 위키 (개념 사전 & 위키 코퍼스 실습)**](docs/llm-wiki.md): 토큰/컨텍스트/온도/환각 등 용어 정리 + 위키백과 RAG 파이프라인
* 🔗 [**Graph DB & OCR 파이프라인 가이드**](docs/pipelines.md): Neo4j 다단계 탐색 및 한글 OCR 문서 복원 파이프라인
* 🔧 [**문제 해결 가이드**](docs/troubleshooting.md): Chroma 포트 충돌 및 DB 초기화 방법
* ☕ [**자바 개발자를 위한 노트**](docs/자바개발자를-위한-노트.md): Java/Spring 관점에서 본 Node/TS 차이점
* 📖 [**RAG 공부 노트**](docs/rag-study-notes.md): 개념·설계 관점으로 정리한 학습 노트 모음 (`cs-study/ai` 사본)

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
| **API 서버** | `npm run server` | Express REST API 서버 구동 (`:3000`) |
| **초기화** | `npm run reset` | 테스트 컬렉션 데이터 초기화 |

---

## 📂 프로젝트 구조

```text
src/
  ├── config.ts         # 통합 환경 설정 (Chroma, Ollama, Neo4j)
  ├── lectures/         # 인프런 강의 실습 예제 (회차 번호와 1:1 일치)
  ├── graph-db/         # Neo4j 지식 그래프 클라이언트 및 스크립트
  ├── ocr/              # 한글 OCR 엔진 및 문서/표 복원 파이프라인
  ├── wiki/             # 위키백과 문서 수집 → 구조 청킹 → RAG 파이프라인
  ├── lib/              # RAG 핵심 공통 모듈 (청킹, 검색, 임베딩, LLM)
  └── server/           # Express REST API 백엔드
docs/                   # 주제별 상세 기술 문서
```
