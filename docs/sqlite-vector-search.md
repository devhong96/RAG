# SQLite 의미 검색과 대화 장기 기억

> 학습 위치: [전체 문서 지도](README.md) · 관련 코드: [`src/sqlite/`](../src/sqlite)

## 1. 두 구현을 구분한다

SQLite에 벡터를 저장하는 것과 벡터 인덱스로 빠르게 검색하는 것은 다른 문제다.

| 방식 | 저장 | 검색 | 용도 |
|---|---|---|---|
| 이 저장소의 기준 구현 | JSON `TEXT` | 애플리케이션에서 전부 비교 | 원리 학습, 소량 데이터, ANN 평가 정답지 |
| SQLite 벡터 확장 | 확장 전용 벡터 타입 | 확장의 ANN/벡터 함수 | 큰 데이터와 낮은 지연시간 |

[`SqliteVectorStore`](../src/sqlite/vector-store.ts)는 첫 번째 방식이다. 정확한 Flat 검색이므로 결과를 근사하지 않지만 데이터가 늘면 선형으로 느려진다. 확장 기반 VSS를 구현했다고 오해해서는 안 된다.

## 2. 스키마

한 행에 원문, 임베딩, 정형 메타데이터를 함께 저장한다.

```sql
CREATE TABLE vector_documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
);
```

`collection + id`를 기본키로 두어 같은 문서를 다시 넣으면 중복이 아니라 갱신된다. 여러 행의 쓰기는 트랜잭션으로 묶는다.

## 3. 검색 흐름

```text
질문 → Ollama 임베딩 → metadata 동등 조건 필터
     → 남은 모든 벡터와 코사인 유사도 계산 → Top-K
```

`npm run lab:sqlite`로 예제를 실행할 수 있다. Ollama와 `bge-m3`가 필요하며 결과 DB는 `data/sqlite-vector-demo.db`에 만들어진다.

## 4. 대화 장기 기억

API의 `sessionId` 대화는 [`SqliteConversationStore`](../src/sqlite/conversation-store.ts)에 저장된다. 서버를 재시작해도 최근 대화가 남고, 세션별로 최근 5턴만 유지한다. 기본 파일은 `data/conversations.sqlite`이며 `CONVERSATION_DB` 환경변수로 바꿀 수 있다.

장기 기억이라고 해서 모든 대화를 프롬프트에 넣지는 않는다. 저장은 오래 하되 검색·생성에는 최근 턴만 넣어 컨텍스트 크기를 제한한다.

## 5. 다음 확장점

- SQLite 벡터 확장으로 Flat 검색을 ANN 검색으로 교체
- 단순 metadata 동등 비교를 범위·논리 조건으로 확장
- 데이터셋 수집기와 PDF 파서 연결
- Flat 결과를 정답으로 삼아 ANN Recall@K 측정
