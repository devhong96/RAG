# SQLite 의미 검색과 대화 장기 기억

> 학습 위치: [전체 문서 지도](README.md) · 관련 코드: [`src/sqlite/`](../src/sqlite)

이 실습의 목표는 SQLite를 대규모 벡터 DB로 쓰는 것이 아니다. **정형 데이터와 벡터를 같은 레코드에 저장할 수 있다는 것**, 그리고 저장 가능성과 빠른 검색 가능성은 별개라는 것을 코드로 확인하는 데 있다.

## 1. 두 구현을 구분한다

SQLite에 벡터를 저장하는 것과 벡터 인덱스로 빠르게 검색하는 것은 다른 문제다.

| 방식 | 저장 | 검색 | 용도 |
|---|---|---|---|
| 이 저장소의 기준 구현 | JSON `TEXT` | 애플리케이션에서 전부 비교 | 원리 학습, 소량 데이터, ANN 평가 정답지 |
| SQLite 벡터 확장 | 확장 전용 벡터 타입 | 확장의 ANN/벡터 함수 | 큰 데이터와 낮은 지연시간 |

[`SqliteVectorStore`](../src/sqlite/vector-store.ts)는 첫 번째 방식이다. 정확한 Flat 검색이므로 결과를 근사하지 않지만 데이터가 늘면 선형으로 느려진다. 확장 기반 VSS를 구현했다고 오해해서는 안 된다.

예를 들어 문서가 100개면 질문 한 번에 최대 100개 벡터를 비교한다. 문서가 100만 개가 되어도 같은 코드는 동작하지만 최대 100만 번 비교해야 한다. ANN 인덱스는 이 전부 비교를 피하려고 일부 후보만 탐색하며, 그 대가로 진짜 최근접 문서를 놓칠 수 있다.

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

각 열의 역할은 다음과 같다.

- `text`: 검색 뒤 LLM에 전달할 원문이다. 벡터만 저장하면 답변 근거를 복원할 수 없다.
- `embedding`: 거리 계산용 숫자 배열이다. JSON은 단순한 학습용 저장 형식이다.
- `dimension`: 다른 차원의 벡터가 같은 컬렉션에 섞이는 사고를 차단한다.
- `metadata`: 카테고리·연도·권한처럼 정형 필터에 사용할 값이다.
- `updated_at`: 재색인과 운영 점검에 필요한 변경 시각이다.

## 3. 검색 흐름

```text
질문 → Ollama 임베딩 → metadata 동등 조건 필터
     → 남은 모든 벡터와 코사인 유사도 계산 → Top-K
```

`npm run lab:sqlite`로 예제를 실행할 수 있다. Ollama와 `bge-m3`가 필요하며 결과 DB는 `data/sqlite-vector-demo.db`에 만들어진다.

## 4. 대화 장기 기억

API의 `sessionId` 대화는 [`SqliteConversationStore`](../src/sqlite/conversation-store.ts)에 저장된다. 서버를 재시작해도 최근 대화가 남고, 세션별로 최근 5턴만 유지한다. 기본 파일은 `data/conversations.sqlite`이며 `CONVERSATION_DB` 환경변수로 바꿀 수 있다.

장기 기억이라고 해서 모든 대화를 프롬프트에 넣지는 않는다. 저장은 오래 하되 검색·생성에는 최근 턴만 넣어 컨텍스트 크기를 제한한다.

## 5. 코드를 읽는 순서

1. [`vector-store.ts`](../src/sqlite/vector-store.ts)의 `CREATE TABLE`에서 한 행의 구성을 확인한다.
2. `upsert`에서 기본키 충돌 시 갱신하는 부분과 트랜잭션 경계를 찾는다.
3. `search`에서 metadata 필터 뒤에 코사인 Top-K를 적용하는 순서를 확인한다.
4. [`sqlite-semantic-search.ts`](../src/lectures/sqlite-semantic-search.ts)에서 임베딩 모델과 저장소가 어디서 연결되는지 본다.
5. [`core.test.ts`](../src/lib/core.test.ts)의 `SQLite 의미 검색` 테스트에서 벡터를 직접 바꿔 순위 변화를 확인한다.

실습하면서 `category: "coffee"` 필터를 제거해 본다. 벡터가 우연히 가까운 다른 카테고리 문서가 후보에 들어올 수 있다. 정형 필터와 의미 검색을 함께 쓰는 이유를 가장 작게 확인하는 실험이다.

## 6. 다음 확장점

- SQLite 벡터 확장으로 Flat 검색을 ANN 검색으로 교체
- 단순 metadata 동등 비교를 범위·논리 조건으로 확장
- 데이터셋 수집기와 PDF 파서 연결
- Flat 결과를 정답으로 삼아 ANN Recall@K 측정

## 7. 학습 확인 질문

1. SQLite에 벡터를 저장할 수 있다는 사실이 곧 빠른 벡터 검색을 뜻하지 않는 이유는 무엇인가?
2. 벡터와 원문을 함께 저장해야 하는 이유는 무엇인가?
3. metadata 필터를 검색 전에 적용하면 어떤 비용을 줄일 수 있는가?
4. Flat 검색과 ANN 검색 중 어느 쪽이 항상 정확한가?
5. 대화 기록을 영속 저장하면서도 최근 몇 턴만 프롬프트에 넣는 이유는 무엇인가?
