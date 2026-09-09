# Graph DB & OCR 파이프라인 가이드

이 문서는 단순 벡터 검색을 보완하기 위해 구축된 **Graph DB(Neo4j)** 및 **한글 OCR 파이프라인**의 상세 안내 문서입니다.

---

## 1. Graph DB (Neo4j) 파이프라인 (`src/graph-db/`)

단일 벡터 검색의 한계인 **다단계 관계(Multi-hop: A -> B -> C)** 추론을 해결하기 위해, Neo4j에 트리플(주어-술어-목적어) 관계망을 저장하고 벡터 검색 결과와 병합하여 리랭킹합니다.

### 실행 스크립트
| 스크립트 | 소스 파일 | 설명 |
|:---|:---|:---|
| `npm run graph:seed` | [`seed.ts`](../../src/graph-db/seed.ts) | Neo4j 노드/엣지 및 Chroma 벡터 청크 적재 |
| `npm run graph:search` | [`search.ts`](../../src/graph-db/search.ts) | 다단계 그래프 탐색 + 벡터 검색 + 리랭킹 답변 생성 |
| `npm run graph:status` | [`status.ts`](../../src/graph-db/status.ts) | 현재 저장된 노드/관계 통계 및 엔티티 확인 |
| `npm run graph:in-memory` | [`in-memory.ts`](../../src/graph-db/in-memory.ts) | 경량 인메모리 지식 그래프 실습 |

### Docker 구동 및 웹 브라우저 시각화
```bash
# Neo4j 컨테이너 실행
docker run -d --name neo4j-rag -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password123! neo4j:5
```
* 브라우저에서 `http://localhost:7474` 접속 (계정: `neo4j` / 비밀번호: `password123!`)
* Cypher 콘솔에 `MATCH (n) RETURN n` 을 실행하면 시각적 관계망 확인 가능

---

## 2. 한글 OCR 파이프라인 (`src/ocr/`)

스캔 문서 이미지에서 텍스트를 추출하고, LLM을 통해 오탈자를 보정하며 마크다운 및 표 구조로 복원하여 벡터 DB에 인제스트합니다.

### 실행 스크립트
| 스크립트 | 소스 파일 | 설명 |
|:---|:---|:---|
| `npm run ocr:parse` | [`parse.ts`](../../src/ocr/parse.ts) | 이미지 전처리(Sharp) + OCR(Tesseract) + LLM 마크다운/표 복원 (`scanned-doc-restored.md` 생성) |
| `npm run ocr:search` | [`search.ts`](../../src/ocr/search.ts) | 복원된 문서를 구조 기반으로 청킹하여 Chroma에 적재하고 질의응답 |

---

## 3. 위키백과 코퍼스 파이프라인 (`src/wiki/`)

한국어 위키백과 API 에서 실제 문서를 받아 제목 계층을 살려 청킹하고 RAG 질의까지 수행합니다.
`npm run wiki:ingest` / `npm run wiki:search` 로 실행하며, 자세한 내용은
[**LLM 위키 문서**](../01-basics/llm-wiki.md)에 정리되어 있습니다.
