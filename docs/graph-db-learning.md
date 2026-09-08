# 그래프 DB 입문 — 모델링부터 Neo4j와 GraphRAG까지

> 학습 위치: [전체 학습 가이드](README.md) · 다음: [GraphRAG 설계](rag-graphdb-hybrid-pipeline.md) · 실행: [Graph DB 파이프라인](pipelines.md#1-graph-db-neo4j-파이프라인-srcgraph-db)

이 문서는 GraphRAG보다 먼저 읽는 그래프 DB 기초 문서다. 목표는 Neo4j 명령을 외우는 것이 아니라, **어떤 데이터를 노드로 만들고 어떤 연결을 관계로 만들어야 하는지**, 그리고 그래프 탐색 결과가 RAG에 어떻게 들어가는지를 이해하는 것이다.

그래프 DB를 처음 접한다는 전제로 작성한다. SQL을 알고 있다면 대응되는 개념을 함께 비교하되, SQL 지식이 없어도 예제를 위에서 아래로 읽을 수 있도록 각 기호와 Clause를 처음 등장할 때 설명한다.

## 목차

1. [학습 목표와 권장 순서](#1-학습-목표와-권장-순서)
2. [그래프 DB는 무엇을 다르게 저장하는가](#2-그래프-db는-무엇을-다르게-저장하는가)
3. [그래프 DB가 실제로 하는 일](#3-그래프-db가-실제로-하는-일)
4. [무엇을 노드·관계·속성으로 만들 것인가](#4-무엇을-노드관계속성으로-만들-것인가)
5. [RDBMS와 그래프 DB 중 무엇을 선택하는가](#5-rdbms와-그래프-db-중-무엇을-선택하는가)
6. [Cypher를 패턴 그림처럼 읽기](#6-cypher를-패턴-그림처럼-읽기)
   - [기호와 노드 패턴 한 줄 해부](#기호부터-읽기)
   - [SQL 개발자를 위한 전체 대응표](#sql-개발자를-위한-전체-대응표)
   - [Clause 실행 흐름](#clause는-위에서-아래로-행을-전달한다)
   - [SELECT — MATCH와 RETURN](#select--match와-return)
   - [CREATE — 새 노드와 관계 생성](#create--새-노드와-관계-생성)
   - [MERGE — 있으면 찾고 없으면 생성](#merge--있으면-찾고-없으면-생성)
   - [UPDATE — MATCH와 SET](#update--match와-set)
   - [DELETE — 대상을 먼저 MATCH](#delete--무엇을-지우는지-먼저-match)
   - [GROUP BY와 집계](#group-by--묵시적-그룹-키)
   - [WITH — 중간 결과 전달](#with--쿼리의-중간-select)
   - [UNWIND — 일괄 처리](#unwind--배열을-행으로-펼쳐-일괄-저장)
   - [OPTIONAL MATCH](#optional-match)
   - [유일성 제약과 인덱스](#유일성-제약과-인덱스)
   - [가변 길이 경로](#가변-길이-경로)
   - [파라미터를 사용하는 이유](#파라미터를-사용하는-이유)
7. [그래프 탐색은 어떻게 동작하는가](#7-그래프-탐색은-어떻게-동작하는가)
8. [이 저장소의 그래프 모델 읽기](#8-이-저장소의-그래프-모델-읽기)
9. [실습 1 — 외부 DB 없이 탐색 원리 보기](#9-실습-1--외부-db-없이-탐색-원리-보기)
10. [실습 2 — Neo4j에서 같은 그래프 실행하기](#10-실습-2--neo4j에서-같은-그래프-실행하기)
11. [벡터 검색과 그래프 검색을 결합하는 이유](#11-벡터-검색과-그래프-검색을-결합하는-이유)
12. [자주 발생하는 실패](#12-자주-발생하는-실패)
13. [학습 확인 질문](#13-학습-확인-질문)
14. [참고 자료](#참고-자료)

## 1. 학습 목표와 권장 순서

이 문서를 마치면 다음을 설명할 수 있어야 한다.

1. 노드, 레이블, 관계, 속성, 경로, 홉의 차이
2. 테이블 조인과 그래프 탐색 중 어느 쪽이 문제에 더 자연스러운지
3. SQL의 `SELECT`, `INSERT`, `UPDATE`, `DELETE`를 Cypher의 `MATCH`, `RETURN`, `CREATE`, `MERGE`, `SET`, `DELETE`로 바꾸는 법
4. 깊이를 무작정 늘린 그래프 탐색이 위험한 이유
5. 벡터 검색과 그래프 검색이 서로 대체 관계가 아닌 이유

권장 학습 순서는 다음과 같다.

```text
속성 그래프 모델 이해
  → 작은 트리플을 손으로 모델링
  → 인메모리 BFS 코드 읽기
  → Cypher로 같은 탐색 실행
  → Neo4j 드라이버 코드 읽기
  → 벡터 검색과 합쳐 GraphRAG 실행
```

처음에는 [GraphRAG 설계](rag-graphdb-hybrid-pipeline.md)나 긴 [하이브리드 워크스루](rag-hybrid-walkthrough.md)부터 읽지 않는다. 그래프 DB 자체와 RAG 결합을 동시에 배우면 `MATCH`가 검색한 것인지 임베딩이 검색한 것인지 구분하기 어렵다.

## 2. 그래프 DB는 무엇을 다르게 저장하는가

Neo4j는 **속성 그래프(property graph)** 모델을 사용한다. 데이터는 다음 네 요소로 표현한다.

- **노드(Node):** 사람, 문서, 농장, 지역처럼 독립적으로 식별할 개체
- **레이블(Label):** `Person`, `Document`, `Farm`처럼 노드의 역할이나 종류
- **관계(Relationship):** `WROTE`, `LOCATED_IN`처럼 두 노드를 잇는 방향 있는 연결
- **속성(Property):** 이름, 생성일, 점수처럼 노드와 관계에 붙는 키-값

공식 설명에서도 관계는 시작 노드와 끝 노드를 가지며, 정확히 하나의 관계 타입을 갖고 방향과 속성을 가질 수 있다고 정의한다. 다만 질의할 때는 필요에 따라 방향을 무시하고 탐색할 수 있다. 방향을 무시하려고 반대 방향 관계를 중복 저장할 필요는 없다. 자세한 정의는 [Neo4j 그래프 DB 개념](https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/)을 참고한다.

예제 도메인을 그래프로 표현하면 다음과 같다.

```text
(게이샤:Variety)
    └─[:KNOWN_FOR]→ (에스메랄다:Farm)
                         └─[:LOCATED_IN]→ (보케테:Region)
                                              ├─[:HAS_SOIL]→ (화산재 토양:Soil)
                                              └─[:HAS_CLIMATE]→ (바하레케:Climate)
```

`게이샤 → 에스메랄다`는 1홉, `게이샤 → 에스메랄다 → 보케테`는 2홉이다. 여러 관계를 이어 만든 전체 연결을 **경로(Path)**라고 한다.

### 한 문장으로 말하면

> 그래프 DB는 개체와 개체 사이의 연결을 저장하고, 특정 개체에서 출발해 관계를 따라가며 연결된 데이터를 찾는 데이터베이스다.

게시판 DB에서 `게시글 ID가 10인 글`을 찾는 것이 값 중심 조회라면, 그래프 DB에서는 `김철수가 작성한 문서가 의존하는 시스템과 그 시스템에서 발생한 장애`처럼 **연결 경로 자체가 질의 대상**이 된다.

### 트리플로 읽기

그래프의 관계 하나는 다음 트리플로 읽을 수 있다.

```text
주어                     술어           목적어
에스메랄다 농장           위치           보케테 고지대
```

코드에서는 `{ source, relation, target }`로 표현한다. 이 형태는 단순해서 LLM이 추출하거나 프롬프트에 직렬화하기 쉽지만, 실제 데이터 모델에서는 각 노드의 안정적인 ID와 타입도 함께 관리해야 한다.

## 3. 그래프 DB가 실제로 하는 일

그래프 DB가 하는 일은 크게 네 단계로 나눌 수 있다.

```text
1. 개체 저장       사람, 문서, 서버를 노드로 저장한다.
2. 관계 저장       작성, 소속, 의존 같은 연결을 관계로 저장한다.
3. 시작점 탐색     이름이나 ID로 탐색을 시작할 노드를 찾는다.
4. 관계 탐색       허용된 관계와 깊이만큼 연결을 따라 결과를 반환한다.
```

예를 들어 다음 데이터가 있다고 하자.

```text
(결제 API)-[:DEPENDS_ON]->(인증 API)
(인증 API)-[:RUNS_ON]->(서버 A)
(서버 A)-[:HAS_INCIDENT]->(장애 101)
```

`결제 API에 영향을 줄 수 있는 장애는 무엇인가?`라는 질문은 다음처럼 처리한다.

1. `결제 API` 노드를 인덱스로 찾는다.
2. `DEPENDS_ON` 관계를 따라 `인증 API`로 이동한다.
3. `RUNS_ON` 관계를 따라 `서버 A`로 이동한다.
4. `HAS_INCIDENT` 관계를 따라 `장애 101`을 찾는다.
5. 지나온 노드·관계·전체 경로 중 요청한 값을 반환한다.

이 과정에서 그래프 DB가 장애의 의미를 스스로 이해하거나 새로운 사실을 추론하는 것은 아니다. **저장된 관계를 정확하게 따라간다.** `결제 API → 인증 API` 관계가 저장돼 있지 않으면 실제로 의존하더라도 찾을 수 없고, 잘못 저장돼 있으면 잘못된 경로를 정확하게 반환한다.

### 그래프 DB가 하지 않는 일

- 문장을 자동으로 임베딩하지 않는다. Neo4j의 벡터 기능을 별도로 사용하지 않는 한 의미 검색은 다른 단계다.
- 원문에서 엔티티와 관계를 자동으로 발견하지 않는다. 애플리케이션이나 LLM 추출 파이프라인이 넣어야 한다.
- 저장되지 않은 관계를 사실처럼 만들어내지 않는다.
- 그래프 결과를 자연어 답변으로 바꾸지 않는다. GraphRAG에서는 이 일을 생성 LLM이 한다.

따라서 GraphRAG에는 보통 서로 다른 세 역할이 있다.

```text
LLM 또는 파서   원문에서 엔티티·관계를 추출
그래프 DB       노드·관계를 저장하고 경로를 탐색
생성 LLM        검색된 문서와 관계를 읽어 자연어로 답변
```

## 4. 무엇을 노드·관계·속성으로 만들 것인가

초기 모델링에는 다음 규칙이 유용하다.

- 중요한 **명사**는 노드 후보로 본다.
- 개체 사이의 **동사**는 관계 후보로 본다.
- 개체를 따로 탐색할 필요가 없는 설명값은 속성 후보로 본다.

예를 들어 `김철수가 2026년에 문서 A를 작성했다`를 생각해 보자.

```text
(김철수:Person)-[:WROTE {year: 2026}]->(문서 A:Document)
```

`김철수`와 `문서 A`는 다른 관계의 출발점이 될 수 있으므로 노드가 자연스럽다. `2026`을 별도 노드로 만들 수도 있지만 연도를 중심으로 다른 개체를 계속 탐색할 요구가 없다면 관계 속성으로 두는 편이 단순하다.

### 노드로 승격할지 판단하는 질문

다음 중 하나라도 “예”라면 속성보다 노드가 어울릴 가능성이 높다.

1. 이 값에서 다른 개체로 관계를 따라갈 것인가?
2. 이 값 자체에 여러 속성을 붙일 것인가?
3. 여러 노드가 같은 값을 공유하며 하나의 동일 개체를 가리키는가?
4. 이 값을 독립적으로 검색하고 수명주기를 관리해야 하는가?

### 안정적인 식별자가 필요하다

사람 이름이나 문서 제목을 유일키로 쓰면 동명이인과 제목 변경에 취약하다. 가능하면 사번, 문서 ID, 외부 시스템 ID처럼 바뀌지 않는 식별자를 사용한다. Neo4j 모델링 가이드도 이름보다 고유 식별자를 쓰는 모델을 권장한다. [Neo4j 데이터 모델링 튜토리얼](https://neo4j.com/docs/getting-started/data-modeling/tutorial-data-modeling/)에서 같은 기준을 확인할 수 있다.

현재 저장소의 학습 예제는 이해하기 쉽게 `Entity.name`을 `MERGE` 기준으로 사용한다. 운영 모델이라면 `id`에 유일성 제약을 걸고 이름은 변경 가능한 속성으로 두는 것이 안전하다.

## 5. RDBMS와 그래프 DB 중 무엇을 선택하는가

그래프 DB는 RDBMS의 상위 호환이 아니다. 질문의 형태가 다르다.

| 질문 | 자연스러운 접근 |
|---|---|
| 주문 번호로 주문 한 건 조회 | RDBMS의 기본키 인덱스 |
| 고객별 월 매출 합계 | RDBMS의 집계와 그룹화 |
| 친구의 친구가 좋아하지만 나는 안 본 영화 | 그래프 경로 탐색 |
| 특정 서버 장애가 몇 단계의 의존 서비스를 거쳐 어디까지 전파되는가 | 그래프 경로 탐색 |
| 본문 의미가 질문과 가까운 문서 찾기 | 벡터 검색 |

RDBMS도 조인과 재귀 CTE로 관계를 따라갈 수 있다. 관계 깊이가 짧고 형태가 고정돼 있다면 기존 RDBMS가 더 단순할 수 있다. 그래프 DB의 장점은 관계가 많고 깊이가 가변적인 문제를 경로 패턴으로 직접 표현하는 데 있다. Neo4j도 관계를 미리 데이터 구조로 저장하는 점이 조인 중심 질의에서 유리하다고 설명한다. 비교는 [Neo4j의 관계형 DB 비교](https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/graphdb-vs-rdbms/)를 참고한다.

도입 판단은 “관계가 있다”가 아니라 다음 질문으로 한다.

> 서비스의 핵심 질의가 여러 종류의 관계를 몇 단계씩 따라가야 하는가?

단순 회원-주문 조회에 그래프 DB를 추가하면 저장소 동기화와 운영 비용만 늘 수 있다.

## 6. Cypher를 패턴 그림처럼 읽기

Cypher는 SQL처럼 선언형이지만, 표 대신 괄호와 화살표로 경로 패턴을 표현한다.

### 기호부터 읽기

Cypher에서 가장 자주 보는 기호는 다음과 같다.

| 문법 | 뜻 | 예시 |
|---|---|---|
| `( )` | 노드 | `(person)` |
| `:Label` | 노드의 분류 | `(person:Person)` |
| `[ ]` | 관계 | `[relation]` |
| `:TYPE` | 관계의 종류 | `[:WROTE]` |
| `{ }` | 속성 | `{name: '김철수'}` |
| `-->`, `<--` | 관계 방향 | `(a)-[:KNOWS]->(b)` |

#### 노드 패턴 한 줄 해부

다음 표현은 하나의 노드 패턴이다.

```cypher
(e:Entity {name: $name})
```

| 부분 | 이름 | 의미 |
|---|---|---|
| `( )` | 노드 괄호 | 괄호 안의 내용이 노드에 대한 표현임을 나타낸다. |
| `e` | 변수명 | 찾거나 생성한 노드를 이 쿼리 안에서 `e`라는 이름으로 참조한다. 이름은 자유롭게 정할 수 있다. |
| `:Entity` | 레이블 | `Entity` 종류로 분류된 노드를 대상으로 한다. SQL의 테이블과 비슷하게 느낄 수 있지만 완전히 같지는 않다. |
| `{ ... }` | 속성 맵 | 노드에 들어갈 속성이나 노드를 찾을 때 사용할 속성 조건을 표현한다. |
| `name` | 속성명 | 노드에 저장된 `name` 속성을 가리킨다. SQL의 컬럼과 비슷하다. |
| `$name` | 파라미터 | 애플리케이션이 쿼리와 별도로 전달하는 값이다. `$`는 파라미터임을 뜻한다. |

따라서 이 표현은 다음 문장으로 읽을 수 있다.

> `Entity` 레이블을 가진 노드 중에서 `name` 속성이 `$name` 파라미터와 같은 노드를 찾아 `e`라는 변수에 담는다.

단, `(e:Entity {name: $name})`만으로는 완성된 조회 명령이 아니다. 이것은 찾으려는 **노드의 모양**, 즉 패턴이다. 앞에 `MATCH`를 붙여 무엇을 찾을지 정하고, `RETURN`으로 무엇을 결과에 보여줄지 정해야 조회 쿼리가 완성된다.

```cypher
MATCH (e:Entity {name: $name})
RETURN e
```

위 쿼리는 다음 순서로 동작한다.

```text
1. MATCH가 Entity 레이블을 가진 노드를 찾는다.
2. 그중 name 속성이 전달받은 값과 같은 노드만 선택한다.
3. 선택된 노드를 e라는 변수에 담는다.
4. RETURN이 e에 담긴 노드를 결과로 반환한다.
```

#### `$name`에는 실제 값이 어떻게 들어가는가

`$name`은 문자열 `$name`을 검색하라는 뜻이 아니다. 애플리케이션이 쿼리와 별도로 전달할 값을 받을 자리다.

```ts
const query = `
  MATCH (e:Entity {name: $name})
  RETURN e
`

await session.run(query, {
  name: "에스메랄다",
})
```

여기서 쿼리의 `$name`과 파라미터 객체의 `name`이 짝을 이룬다.

```text
쿼리 안       $name
                ↑ 같은 이름
전달 객체      name: "에스메랄다"
```

따라서 개념적으로는 다음 조건을 실행하는 것과 같다.

```cypher
MATCH (e:Entity {name: "에스메랄다"})
RETURN e
```

실제로는 드라이버가 문자열을 쿼리에 직접 이어 붙이지 않고 별도의 파라미터로 안전하게 바인딩한다. 따라서 사용자 입력에 따옴표가 들어 있어도 쿼리 문법과 값이 섞이지 않는다.

#### SQL과 비교해서 읽기

위 조회를 SQL로 표현하면 대략 다음과 같다.

```sql
SELECT *
FROM entity AS e
WHERE e.name = '에스메랄다';
```

처음에는 다음처럼 대응시켜도 좋다.

| Cypher | SQL에서 비슷한 개념 | 주의할 차이 |
|---|---|---|
| `e` | 테이블 별칭 | Cypher에서는 노드 한 개를 가리키는 쿼리 변수다. |
| `Entity` | 테이블 | 실제로는 노드를 분류하는 레이블이다. 한 노드에 레이블이 여러 개 붙을 수도 있다. |
| `name` | 컬럼 | Cypher에서는 노드에 저장된 속성이다. 같은 레이블의 모든 노드가 반드시 같은 속성을 가질 필요는 없다. |
| `$name` | `:name`, `?` 같은 바인딩 파라미터 | `$` 뒤의 이름으로 전달 객체의 값을 찾는다. |
| `MATCH` | `FROM`과 `JOIN`의 일부 역할 | 행이 아니라 노드와 관계의 패턴을 찾는다. |
| `RETURN` | `SELECT` | 반환할 노드, 관계, 속성 또는 계산값을 고른다. |

Cypher의 레이블을 SQL 테이블과 완전히 같다고 생각하면 나중에 혼란이 생긴다. SQL에서는 한 행이 특정 테이블에 속하지만, 그래프에서는 하나의 노드에 `Person`과 `Employee`처럼 여러 레이블을 붙일 수 있다.

#### `e`라는 변수명은 바꿔도 된다

`e`는 Neo4j가 정한 예약어가 아니다. 현재 쿼리 안에서 노드를 가리키기 위해 개발자가 붙인 변수명이다.

```cypher
MATCH (entity:Entity {name: $name})
RETURN entity
```

```cypher
MATCH (coffeeFarm:Entity {name: $name})
RETURN coffeeFarm
```

두 쿼리는 같은 조건으로 노드를 찾는다. 변수명이 길어졌을 뿐 동작은 같다. 다만 `coffeeFarm`처럼 역할이 드러나는 이름은 긴 쿼리를 읽기 쉽게 만든다.

변수명을 바꾸었다면 `RETURN`에서도 같은 이름을 사용해야 한다.

```cypher
// 잘못된 예: entity를 선언했지만 e를 반환하려고 한다.
MATCH (entity:Entity {name: $name})
RETURN e
```

위 쿼리에는 `e`라는 변수가 선언되지 않았으므로 오류가 발생한다.

#### 괄호와 중괄호는 짝을 맞춘다

```text
// 불완전한 표현
e:Entity {name: $name

// 완전한 노드 패턴
(e:Entity {name: $name})
```

바깥의 `( )`는 노드 전체를 감싸고, 안쪽의 `{ }`는 속성을 감싼다. 닫는 순서는 여는 순서의 반대다.

```text
( e:Entity { name: $name } )
│          │             │ │
└─ 노드 시작             │ └─ 노드 끝
           └─ 속성 시작  └─── 속성 끝
```

#### 같은 패턴도 Clause에 따라 동작이 달라진다

`(e:Entity {name: $name})`이라는 패턴 자체는 같지만, 앞에 어떤 Clause를 붙이느냐에 따라 찾기·생성·조건부 생성을 수행한다.

```cypher
// 조건에 맞는 기존 노드를 찾는다.
MATCH (e:Entity {name: $name})
RETURN e
```

```cypher
// 전달받은 이름으로 새 노드를 만든다.
CREATE (e:Entity {name: $name})
RETURN e
```

```cypher
// 있으면 찾고 없으면 만든다.
MERGE (e:Entity {name: $name})
RETURN e
```

즉, 괄호 안은 **어떤 노드인가**를 설명하고, 괄호 앞의 Clause는 **그 노드로 무엇을 할 것인가**를 결정한다.

다음 패턴을 왼쪽부터 소리 내어 읽어 본다.

```cypher
(person:Person {name: '김철수'})-[:WROTE]->(document:Document)
```

> `Person`인 `person` 노드 중 이름이 김철수인 노드가 `WROTE` 관계로 연결한 `Document` 노드를 찾는다.

`person`과 `document`는 쿼리 안에서 다시 사용할 **변수명**이고, `Person`과 `Document`는 저장된 노드를 분류하는 **레이블**이다. 변수명은 이 쿼리 안에서만 존재하지만 레이블은 DB에 저장된다.

```cypher
MATCH (farm:Entity {name: $farm})-[rel:RELATION]->(region:Entity)
WHERE rel.type = '위치'
RETURN farm.name, rel.type, region.name
```

왼쪽부터 읽으면 된다.

1. `(farm:Entity ...)`: `Entity` 레이블을 가진 시작 노드를 찾는다.
2. `-[rel:RELATION]->`: `RELATION` 타입의 나가는 관계를 탄다.
3. `(region:Entity)`: 도착 노드를 `region` 변수에 담는다.
4. `WHERE`: 관계 속성이 `위치`인 결과만 남긴다.
5. `RETURN`: 필요한 값을 반환한다.

### SQL 개발자를 위한 전체 대응표

Cypher에는 SQL의 `SELECT`, `INSERT`, `UPDATE`와 정확히 같은 키워드가 없다. 같은 작업을 여러 Clause를 조합해 표현한다.

| 하고 싶은 일 | SQL | Cypher |
|---|---|---|
| 행/노드 조회 | `SELECT ... FROM ...` | `MATCH ... RETURN ...` |
| 조건 적용 | `WHERE ...` | `MATCH ... WHERE ...` |
| 새 데이터 삽입 | `INSERT` | `CREATE` |
| 없을 때만 생성 | DB별 UPSERT 문법 | `MERGE` |
| 기존 데이터 수정 | `UPDATE ... SET` | `MATCH ... SET` |
| 속성 제거 | `UPDATE ... SET col = NULL` 또는 별도 문법 | `MATCH ... REMOVE` |
| 데이터 삭제 | `DELETE FROM` | `MATCH ... DELETE` |
| 연결된 관계까지 삭제 | FK 정책 또는 여러 `DELETE` | `MATCH ... DETACH DELETE` |
| 테이블 조인 | `JOIN ... ON ...` | `MATCH` 안의 관계 패턴 |
| 외부 조인 | `LEFT JOIN` | `OPTIONAL MATCH` |
| 조회 열 선택 | `SELECT column` | `RETURN expression` |
| 중복 제거 | `SELECT DISTINCT` | `RETURN DISTINCT` |
| 그룹 집계 | `GROUP BY` | 집계하지 않은 `RETURN/WITH` 표현이 묵시적 그룹 키 |
| 중간 결과 전달 | CTE·서브쿼리 | `WITH` |
| 배열을 여러 행으로 펼침 | DB별 `UNNEST` | `UNWIND` |

가장 중요한 대응은 다음 네 줄이다.

```text
SELECT  → MATCH + RETURN
INSERT  → CREATE 또는 MERGE
UPDATE  → MATCH + SET
DELETE  → MATCH + DELETE 또는 DETACH DELETE
```

SQL은 보통 `테이블에서 행을 고른다`고 생각하지만, Cypher는 `그래프에서 이 모양과 일치하는 경로를 찾는다`고 생각한다.

```sql
-- SQL: 작성자와 문서를 조인한다.
SELECT p.name, d.title
FROM person p
JOIN document d ON d.author_id = p.id
WHERE p.name = '김철수';
```

```cypher
// Cypher: 사람에서 WROTE 관계를 따라 문서를 찾는다.
MATCH (p:Person {name: '김철수'})-[:WROTE]->(d:Document)
RETURN p.name, d.title
```

Cypher에는 `JOIN`이라는 단어가 보이지 않는다. `(p)-[:WROTE]->(d)`라는 패턴이 조인의 역할과 관계 탐색을 함께 표현한다.

### Clause는 위에서 아래로 행을 전달한다

Cypher 쿼리는 Clause가 위에서 아래로 중간 결과 행을 넘기는 파이프라인으로 동작한다.

```cypher
MATCH (p:Person)
WHERE p.active = true
WITH p
MATCH (p)-[:WROTE]->(d:Document)
RETURN p.name, count(d) AS documentCount
```

흐름은 다음과 같다.

```text
MATCH   Person 노드를 행으로 만든다
WHERE   active=true인 행만 남긴다
WITH    p를 다음 쿼리 부분으로 전달한다
MATCH   각 p에서 WROTE 관계를 따라 d를 붙인다
RETURN  사람별 문서 수를 결과로 만든다
```

중간 `MATCH`가 결과를 하나도 만들지 못하면 뒤 Clause에 전달할 행도 없어져 쿼리 결과가 사라진다. 연결이 없어도 앞쪽 행을 유지하려면 `OPTIONAL MATCH`를 사용한다. Neo4j 공식 문서도 `OPTIONAL MATCH`를 SQL 외부 조인과 유사한 동작으로 설명한다.

`WHERE`는 독립 실행 명령이 아니라 바로 앞의 `MATCH`, `OPTIONAL MATCH`, 또는 `WITH` 결과에 조건을 붙이는 하위 Clause다. 여러 `MATCH`가 있을 때 `WHERE` 위치를 잘못 두면 결과 의미와 성능이 모두 달라질 수 있다.

### SELECT — MATCH와 RETURN

```cypher
MATCH (e:Entity)
RETURN e.id AS id, e.name AS name
ORDER BY name ASC
LIMIT 10
```

- `MATCH`: 어떤 노드·관계 패턴을 찾을지 정한다.
- `RETURN`: 최종 결과에 포함할 노드, 관계, 속성, 계산값을 정한다.
- `AS`: 반환 열에 별칭을 붙인다.
- `ORDER BY`: 결과 순서를 보장한다.
- `LIMIT`: 반환 행 수를 제한한다.

노드 전체를 반환할 수도 있고 속성만 반환할 수도 있다.

```cypher
MATCH (e:Entity {name: $name})
RETURN e                 // 노드 전체
```

```cypher
MATCH (e:Entity {name: $name})
RETURN e.id, e.name      // 필요한 속성만
```

서비스 코드에서는 필요한 속성만 반환하는 편이 네트워크 전송량과 결과 DTO를 명확하게 관리하기 쉽다.

관계도 변수에 담아 반환할 수 있다.

```cypher
MATCH (source:Entity)-[relation:RELATION]->(target:Entity)
RETURN source.name, relation.type, target.name
```

현재 저장소에서는 이 결과 한 행이 `source → relation → target` 트리플 하나가 된다.

### CREATE — 새 노드와 관계 생성

SQL의 `INSERT`에 해당하는 기본 생성 Clause가 `CREATE`다. `CREATE`는 같은 데이터가 이미 있는지 검사하지 않고 지정한 패턴을 새로 만든다.

노드 하나를 생성한다.

```cypher
CREATE (p:Person {id: 'p-1', name: '김철수'})
RETURN p
```

노드 여러 개와 그 사이의 관계를 한 번에 생성할 수도 있다.

```cypher
CREATE (p:Person {id: 'p-2', name: '이영희'})
       -[:WROTE {createdAt: datetime()}]->
       (d:Document {id: 'd-2', title: '그래프 DB 입문'})
RETURN p, d
```

이미 저장된 두 노드 사이에 관계만 추가하려면 양쪽 노드를 `MATCH`로 찾은 뒤 관계를 `CREATE`한다.

```cypher
MATCH (p:Person {id: 'p-1'})
MATCH (d:Document {id: 'd-1'})
CREATE (p)-[:WROTE {createdAt: datetime()}]->(d)
RETURN p, d
```

`CREATE`는 중복을 확인하지 않는다. 따라서 첫 번째 예제를 두 번 실행하면 `id: 'p-1'`인 노드가 두 개 생길 수 있다. 유일성 제약이 있다면 두 번째 실행은 중복 노드를 만드는 대신 오류가 난다.

### MERGE — 있으면 찾고 없으면 생성

`MERGE`는 SQL 제품별 `UPSERT`와 비슷하다. 지정한 패턴을 찾고, 없을 때만 만든다.

```cypher
MERGE (p:Person {id: $id})
ON CREATE SET p.name = $name, p.createdAt = datetime()
ON MATCH SET p.name = $name, p.updatedAt = datetime()
RETURN p
```

- `ON CREATE SET`: 이번에 새로 만들어졌을 때만 실행한다.
- `ON MATCH SET`: 이미 있던 노드를 찾았을 때만 실행한다.
- 뒤의 일반 `SET`: 생성·조회 어느 경우든 실행한다.

`MERGE (p:Person {id: $id, name: $name})`처럼 변경 가능한 이름까지 식별 패턴에 넣으면 이름이 바뀔 때 새 노드가 생길 수 있다. 안정적인 ID만 `MERGE` 기준으로 두고 나머지는 `SET`으로 갱신하는 편이 안전하다.

| 상황 | 권장 Clause | 이유 |
|---|---|---|
| 실행할 때마다 새 이벤트를 기록 | `CREATE` | 중복 여부와 관계없이 새 기록이 필요하다. |
| 사용자 ID처럼 같은 개체를 재사용 | `MERGE` | 같은 식별자의 노드를 찾아 재사용한다. |
| 기존 노드 사이에 새 관계 추가 | `MATCH` + `CREATE` | 노드는 재사용하고 관계만 새로 만든다. |
| 관계도 한 번만 존재해야 함 | `MATCH` + 관계 `MERGE` | 같은 관계 패턴의 반복 생성을 줄인다. |

```cypher
MATCH (p:Person {id: $personId})
MATCH (d:Document {id: $documentId})
MERGE (p)-[r:WROTE]->(d)
ON CREATE SET r.createdAt = datetime()
RETURN r
```

정리하면 `CREATE`는 **항상 생성**, `MERGE`는 **패턴을 확인한 뒤 필요할 때 생성**이다. `MERGE`도 안정적인 식별자와 유일성 제약 없이 사용하면 의도한 중복 방지를 보장하기 어렵다.

### UPDATE — MATCH와 SET

Cypher에는 독립적인 `UPDATE` 키워드가 없다. 수정할 패턴을 `MATCH`로 찾고 `SET`으로 변경한다.

```cypher
MATCH (p:Person {id: $id})
SET p.name = $name,
    p.active = true,
    p.updatedAt = datetime()
RETURN p
```

여러 속성을 한 번에 덮어쓸 때는 맵 파라미터를 사용할 수 있다.

```cypher
MATCH (p:Person {id: $id})
SET p += $properties
RETURN p
```

`+=`는 전달한 속성을 추가하거나 같은 키의 값을 갱신한다. 반면 `SET p = $properties`는 기존 속성 전체를 새 맵으로 교체하므로 ID 같은 필드까지 사라질 수 있어 차이를 알고 사용해야 한다.

속성을 없앨 때는 `REMOVE`를 사용한다.

```cypher
MATCH (p:Person {id: $id})
REMOVE p.description
RETURN p
```

관계 속성도 같은 방식으로 수정한다.

```cypher
MATCH (:Person {id: $personId})-[r:WROTE]->(:Document {id: $documentId})
SET r.reviewed = true
RETURN r
```

### DELETE — 무엇을 지우는지 먼저 MATCH

노드 삭제:

```cypher
MATCH (p:Person {id: $id})
DELETE p
```

이 쿼리는 `p`에 관계가 하나라도 연결돼 있으면 실패한다. 연결 관계까지 모두 지우려면 다음을 사용한다.

```cypher
MATCH (p:Person {id: $id})
DETACH DELETE p
```

관계만 지우고 두 노드는 남길 수도 있다.

```cypher
MATCH (p:Person {id: $personId})-[r:WROTE]->(d:Document {id: $documentId})
DELETE r
RETURN p, d
```

SQL과 마찬가지로 `MATCH` 범위를 잘못 잡으면 여러 데이터를 지운다. 삭제 전에는 같은 `MATCH`에 `RETURN`을 붙여 대상을 먼저 확인하는 습관이 안전하다.

```cypher
// 1. 먼저 확인
MATCH (p:Person)
WHERE p.active = false
RETURN p.id, p.name

// 2. 확인한 조건으로 삭제
MATCH (p:Person)
WHERE p.active = false
DETACH DELETE p
```

### GROUP BY — 묵시적 그룹 키

이 저장소가 실행하는 Neo4j 5 계열에서는 보통 별도 `GROUP BY` Clause 대신, 집계 함수가 아닌 반환 표현이 그룹 키가 된다.

```cypher
MATCH (p:Person)-[:WROTE]->(d:Document)
RETURN p.name, count(d) AS documentCount
ORDER BY documentCount DESC
```

여기서 `p.name`은 그룹 키이고 `count(d)`는 그룹별 집계값이다. SQL로 표현하면 다음과 같다.

```sql
SELECT p.name, COUNT(d.id)
FROM person p
JOIN document d ON d.author_id = p.id
GROUP BY p.name;
```

자주 쓰는 집계 함수는 `count()`, `sum()`, `avg()`, `min()`, `max()`, `collect()`다. `collect(d.title)`은 그룹에 속한 여러 값을 리스트 하나로 모은다.

집계 결과를 다시 필터링하려면 `WITH`로 중간 결과를 만든다. SQL의 `HAVING`과 비슷한 자리에 해당한다.

```cypher
MATCH (p:Person)-[:WROTE]->(d:Document)
WITH p, count(d) AS documentCount
WHERE documentCount >= 3
RETURN p.name, documentCount
```

최신 Cypher 25에는 명시적 `GROUP BY` 문법도 추가됐지만, 이 프로젝트의 `neo4j:5` 실습에서는 위의 묵시적 그룹 방식으로 학습한다.

### WITH — 쿼리의 중간 SELECT

`WITH`는 현재 결과 중 다음 단계로 넘길 변수와 계산값을 정한다. SQL의 CTE나 파생 테이블과 비슷하지만, Cypher에서는 Clause 파이프라인을 이어주는 역할이 더 강하다.

```cypher
MATCH (p:Person)-[:WROTE]->(d:Document)
WITH p, count(d) AS count
ORDER BY count DESC
LIMIT 5
MATCH (p)-[:BELONGS_TO]->(team:Team)
RETURN p.name, count, team.name
```

첫 번째 부분에서 문서를 많이 쓴 사람 5명만 남긴 뒤, 그 사람들의 팀을 탐색한다. `WITH`에 적지 않은 변수는 다음 부분에서 사용할 수 없다. 예를 들어 `WITH p`만 썼다면 뒤에서 `d`를 참조할 수 없다.

### UNWIND — 배열을 행으로 펼쳐 일괄 저장

애플리케이션에서 노드 여러 개를 한 번에 넣을 때 한 건마다 쿼리를 호출하면 네트워크 왕복이 반복된다. 배열 파라미터를 보내고 `UNWIND`로 행처럼 펼칠 수 있다.

```cypher
UNWIND $entities AS row
MERGE (e:Entity {id: row.id})
SET e.name = row.name,
    e.type = row.type
```

```ts
await session.run(query, {
  entities: [
    { id: "e-1", name: "게이샤", type: "Variety" },
    { id: "e-2", name: "보케테", type: "Region" },
  ],
})
```

`UNWIND`는 리스트 요소를 각각 한 행으로 만든다. `UNWIND` 자체는 행 순서를 보장하지 않으므로 순서가 필요하면 `ORDER BY`를 명시한다.

### OPTIONAL MATCH

SQL의 `LEFT JOIN`처럼 연결된 데이터가 없어도 시작 노드를 남기고 싶을 때 사용한다.

```cypher
MATCH (e:Entity {name: $name})
OPTIONAL MATCH (e)-[r:RELATION]->(connected:Entity)
RETURN e.name, r.type, connected.name
```

관계가 없으면 `r`과 `connected`가 `null`로 반환된다. 일반 `MATCH`였다면 해당 행 자체가 결과에서 빠진다.

### 유일성 제약과 인덱스

```cypher
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity)
REQUIRE e.id IS UNIQUE
```

제약은 잘못된 중복을 막고, 해당 값을 찾는 작업에 인덱스를 제공한다. 그래프 탐색이 관계를 빠르게 탄다고 해도 **시작 노드를 찾는 과정**에는 여전히 인덱스가 중요하다. 제약 종류와 현재 문법은 [Neo4j 제약 조건 문서](https://neo4j.com/docs/cypher-manual/current/schema/constraints/)를 확인한다.

### 가변 길이 경로

```cypher
MATCH path = (start:Entity {name: $name})-[:RELATION*1..2]-(connected:Entity)
RETURN path
```

`*1..2`는 한 홉부터 두 홉까지 탐색한다. 화살표 끝을 생략한 `-[]-`는 관계 방향을 무시하고 양방향으로 찾는다. 저장된 관계의 의미가 사라지는 것은 아니다. 질의할 때 양쪽 방향으로 통과할 수 있게 한 것이다.

현재 [`client.ts`](../src/graph-db/client.ts)는 깊이를 문자열 치환하기 전에 1~5로 제한하고, 나머지 사용자 값은 `$startName` 같은 파라미터로 전달한다. 값은 문자열 연결보다 파라미터로 보내야 따옴표 오류와 Cypher 인젝션 위험을 줄일 수 있다.

### 파라미터를 사용하는 이유

```cypher
// 권장
MATCH (e:Entity {name: $name}) RETURN e
```

```ts
await session.run(query, { name: userInput })
```

사용자 입력을 쿼리 문자열에 직접 붙이지 않는다.

```ts
// 피해야 함
const query = `MATCH (e:Entity {name: '${userInput}'}) RETURN e`
```

파라미터를 사용하면 값 안의 따옴표를 드라이버가 처리하고, 사용자 입력이 Cypher 문법으로 해석되는 것을 막는다. 쿼리 실행 계획도 재사용하기 쉬워진다.

## 7. 그래프 탐색은 어떻게 동작하는가

가장 작은 구현은 [`KnowledgeGraph`](../src/lib/graph/knowledge-graph.ts)다. Neo4j 없이 `Map`과 배열로 만든 인접 리스트이며, 가까운 관계부터 찾기 위해 BFS를 사용한다.

```text
queue        앞으로 방문할 노드의 대기열
visited      이미 방문 예약한 노드 집합
visitedEdges 이미 결과에 담은 관계 집합
```

`visited`가 없으면 `A → B → A → B` 같은 순환에서 무한히 돈다. `visitedEdges`는 같은 관계가 여러 경로에 포함되어 결과에 반복되는 것을 막는다.

### 깊이는 정확도가 아니라 탐색 범위다

깊이 1은 가까워서 관련성이 높을 가능성이 있지만, 깊이 4라고 틀린 관계는 아니다. 문제는 멀리 갈수록 질문과 무관한 관계가 빠르게 섞이고 후보 수가 늘어난다는 점이다.

분기 수가 노드마다 10개라면 단순한 트리에서는 다음처럼 커질 수 있다.

```text
1홉: 10개
2홉: 100개
3홉: 1,000개
```

실제 그래프는 중복 경로가 있어 이 계산과 정확히 같지는 않지만, 깊이를 하나 늘리는 비용이 단순히 한 건 늘어나는 것이 아니라는 감각이 중요하다.

### 슈퍼노드

전사 공지, 국가, 공통 라이브러리처럼 관계가 수천·수만 개 붙은 노드를 슈퍼노드라고 부른다. 이런 노드를 만나면 깊이가 작아도 결과가 폭발한다.

다음 세 제한을 함께 사용한다.

1. 최대 홉 수 제한
2. 허용할 관계 타입 제한
3. 반환 개수와 시간 제한

`LIMIT`만 마지막에 붙이면 DB가 이미 거대한 중간 경로를 만든 뒤일 수 있다. 가능한 한 시작 노드와 관계 타입을 일찍 좁히는 것이 중요하다.

## 8. 이 저장소의 그래프 모델 읽기

현재 Neo4j 저장 구조는 다음처럼 단순화돼 있다.

```text
(source:Entity)-[:RELATION {type: '위치'}]->(target:Entity)
```

모든 관계의 Neo4j 타입은 `RELATION`이고 실제 의미는 `type` 속성에 저장한다. TypeScript의 `{ source, relation, target }` 인터페이스 하나로 모든 관계를 다루기 쉬운 대신, Neo4j에서 `[:LOCATED_IN]`처럼 관계 타입 자체로 탐색 범위를 좁히는 장점은 덜 활용한다.

이것은 학습용 추상화다. 운영 모델에서는 다음 형태를 검토한다.

```text
(farm:Farm)-[:LOCATED_IN]->(region:Region)
(region:Region)-[:HAS_CLIMATE]->(climate:Climate)
```

관계 타입이 구체적이면 질의 의도가 명확하고 불필요한 관계를 덜 탐색한다. 반대로 관계 종류가 사용자 데이터에 따라 무한히 늘어나는 시스템이라면 일반 관계 타입과 속성 방식이 관리하기 쉬울 수도 있다.

### 코드 읽는 순서

1. [`knowledge-graph.ts`](../src/lib/graph/knowledge-graph.ts)의 `addRelation`과 `traverse`를 읽는다.
2. [`core.test.ts`](../src/lib/core.test.ts)의 `지식 그래프` 테스트로 2홉 결과를 확인한다.
3. [`seed.ts`](../src/graph-db/seed.ts)의 `RELATIONS`를 그림으로 옮긴다.
4. [`client.ts`](../src/graph-db/client.ts)에서 같은 동작을 Cypher로 어떻게 바꿨는지 본다.
5. [`graph-rag.ts`](../src/lib/search/graph-rag.ts)에서 그래프 팩트와 벡터 문서가 합쳐지는 지점을 찾는다.
6. [`search.ts`](../src/graph-db/search.ts)에서 검색 결과를 재사용해 중복 검색을 피하는 흐름을 확인한다.

## 9. 실습 1 — 외부 DB 없이 탐색 원리 보기

먼저 단위 테스트를 실행한다.

```bash
npm test
```

`지식 그래프` 테스트는 `A → B → C` 관계에서 A를 기준으로 2홉을 탐색한다. 다음 실험을 직접 해 본다.

1. `C → A` 관계를 추가해 순환을 만든다.
2. 깊이를 1로 줄여 C가 결과에서 빠지는지 확인한다.
3. 시작점을 B로 바꾸어 양방향 탐색 결과를 확인한다.
4. 같은 관계를 두 번 추가했을 때 저장과 결과가 어떻게 달라지는지 관찰한다.

이 단계의 목표는 Neo4j 사용법이 아니라 BFS, 깊이, 순환 방지를 이해하는 것이다.

## 10. 실습 2 — Neo4j에서 같은 그래프 실행하기

### 1. 서비스 실행

```bash
docker run -d --name neo4j-rag \
  -p 7474:7474 -p 7687:7687 \
  -e 'NEO4J_AUTH=neo4j/password123!' \
  neo4j:5

ollama serve
npm run db
```

- `7474`: Neo4j Browser용 HTTP 포트
- `7687`: 애플리케이션 드라이버가 사용하는 Bolt 포트

이미 컨테이너를 만든 경우에는 `docker start neo4j-rag`를 사용한다.

### 2. 데이터 적재와 확인

```bash
npm run graph:seed
npm run graph:status
```

`graph:seed`는 Neo4j만 적재하지 않는다. 같은 예제를 비교하기 위해 Neo4j에 관계를 저장하고 Chroma에 문서 청크도 저장한다. 따라서 Neo4j, Chroma, Ollama가 모두 필요하다.

브라우저에서 `http://localhost:7474`에 접속해 다음 쿼리를 실행한다.

```cypher
MATCH (source:Entity)-[rel:RELATION]->(target:Entity)
RETURN source, rel, target
```

표 보기에서는 속성을, 그래프 보기에서는 연결 방향을 확인한다.

### 3. 탐색 범위 비교

```cypher
MATCH path = (start:Entity {name: '게이샤'})-[*1..1]-(connected:Entity)
RETURN path
```

그다음 `*1..1`을 `*1..2`, `*1..3`으로 바꾼다. 결과 경로 수와 새로 포함된 노드를 기록한다. 깊이가 늘 때 결과가 단순히 한 노드씩 늘지 않는 이유를 확인한다.

## 11. 벡터 검색과 그래프 검색을 결합하는 이유

두 검색은 서로 다른 질문을 푼다.

```text
벡터 검색: 이 질문과 의미가 비슷한 문서 조각은 무엇인가?
그래프 검색: 이 개체와 명시적으로 연결된 개체와 관계는 무엇인가?
```

질문이 `게이샤 농장이 있는 지역의 기후 특징`이라면 벡터 검색은 `게이샤`나 `기후`가 들어간 청크를 찾는다. 그래프는 `게이샤 → 농장 → 지역 → 기후` 연결을 따라 질문에 직접 등장하지 않은 `보케테`와 `바하레케`를 후보로 가져올 수 있다.

이 저장소의 [`searchGraphRAG`](../src/lib/search/graph-rag.ts)는 다음 순서로 동작한다.

```text
질문
 ├─ Chroma 벡터 검색 ──────────┐
 └─ Neo4j/인메모리 그래프 탐색 ─┤
                                ▼
                         후보 하나로 병합
                                ▼
                     크로스 인코더 재랭킹
                                ▼
                         Top-K를 LLM에 전달
```

```bash
npm run graph:search
```

출력에서 `[Chroma 벡터문서]`와 `[Neo4j 지식관계]`가 각각 몇 개 살아남았는지 본다. 그래프 결과가 항상 우선인 것은 아니다. 두 후보를 함께 재랭킹해 현재 질문과 더 관련 있는 것을 남긴다.

## 12. 자주 발생하는 실패

### 엔티티 해소 실패

`에스메랄다`, `에스메랄다 농장`, `Hacienda La Esmeralda`가 서로 다른 노드로 저장되면 실제로 같은 개체인데 경로가 끊긴다. 표기 정규화, 별칭 테이블, 안정적인 외부 ID가 필요하다.

### 관계 방향 오류

`농장 -[위치]-> 지역`과 `지역 -[위치]-> 농장`은 읽히는 뜻이 다르다. 탐색을 양방향으로 하더라도 저장 방향과 관계 이름은 자연스러운 문장이 되도록 정한다.

### 중복 관계

`CREATE`를 반복하거나 `MERGE` 기준이 흔들리면 같은 관계가 여러 개 생긴다. 유일성 제약은 노드 중복을 막지만, 관계 중복 정책도 별도로 설계해야 한다.

### 오래된 그래프

원문이 바뀌었는데 이전 엔티티와 관계를 삭제하지 않으면 벡터 DB는 최신인데 그래프는 과거 사실을 반환할 수 있다. 관계에 `sourceDocumentId`, 추출 버전, 갱신 시각을 남겨 원문 단위로 교체할 수 있어야 한다.

### LLM 추출 오류

GraphRAG에서는 문서에서 엔티티와 관계를 뽑는 단계 자체가 생성 모델 호출일 수 있다. 잘못 추출된 관계는 DB에서 정확히 검색되더라도 사실로는 틀리다. 검색 평가와 별도로 트리플 정확도 평가가 필요하다.

## 13. 학습 확인 질문

1. 관계에도 속성을 붙일 수 있는 사례를 하나 만들어 보라.
2. `MERGE`와 유일성 제약을 함께 써야 하는 이유는 무엇인가?
3. 그래프 탐색에서 시작 노드 인덱스가 중요한 이유는 무엇인가?
4. 방향 있는 관계를 저장하면서 양방향 검색이 가능한 이유는 무엇인가?
5. 깊이 3 탐색이 깊이 1보다 단순히 세 배 비싸다고 말할 수 없는 이유는 무엇인가?
6. 현재 저장소의 `:RELATION {type: ...}` 모델이 갖는 장점과 단점은 무엇인가?
7. 벡터 검색 결과만으로 답할 수 없는 다중 홉 질문을 하나 만들어 보라.
8. 그래프 데이터가 최신 원문과 어긋나는 것을 어떻게 감지할 것인가?

마지막으로 다음 문장을 자기 말로 설명할 수 있으면 기초가 잡힌 것이다.

> 그래프 DB는 의미가 비슷한 문장을 찾는 DB가 아니라, 개체 사이에 저장된 관계를 경로로 탐색하는 DB다. GraphRAG는 이 구조적 결과를 벡터 검색 결과와 함께 LLM의 근거로 사용한다.

## 참고 자료

- [Neo4j: What is a graph database?](https://neo4j.com/docs/getting-started/graph-database/)
- [Neo4j: Graph database concepts](https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/)
- [Neo4j: Cypher 소개](https://neo4j.com/docs/getting-started/cypher/)
- [Neo4j Cypher Manual: Clause 목록](https://neo4j.com/docs/cypher-manual/current/clauses/)
- [Neo4j Cypher Manual: MERGE](https://neo4j.com/docs/cypher-manual/current/clauses/merge/)
- [Neo4j Cypher Manual: Constraints](https://neo4j.com/docs/cypher-manual/current/schema/constraints/)
