/**
 * 경량 지식 그래프 (Knowledge Graph / Graph DB).
 *
 * RAG에서 순수 벡터 검색(Bi-Encoder)은 개별 청크 단위의 의미적 유사도만 보기 때문에,
 * 여러 문서에 걸쳐 파편화된 다단계 관계(Multi-hop: A -> B -> C)를 추론하기 어렵다.
 *
 * 지식 그래프는 개체(Entity/Node)와 관계(Relation/Edge)를 트리플(주어-술어-목적어) 형태로
 * 보존하여, 그래프 탐색(Graph Traversal)을 통해 숨겨진 맥락과 연결 고리를 찾아낸다.
 */

// [자바 노트] Neo4j, AWS Neptune 같은 그래프 DB의 핵심 개념(Node, Edge)을
//            TypeScript 인메모리 인접 리스트(Adjacency List)로 구현한 것이다.
//            스프링 생태계에서는 Spring Data Neo4j(SDN)로 다루는 엔티티 관계와 같다.

export interface Entity {
  id: string
  name: string
  type: string
  description?: string
}

export interface Relation {
  source: string // source entity name
  relation: string // 관계 (예: "원산지", "보유기술", "출시연도")
  target: string // target entity name
}

export interface Triple {
  source: string
  relation: string
  target: string
  depth: number
}

export class KnowledgeGraph {
  private entities = new Map<string, Entity>()
  // source -> Relation[] 인접 리스트
  private outgoing = new Map<string, Relation[]>()
  // target -> Relation[] 역방향 인접 리스트 (양방향 탐색용)
  private incoming = new Map<string, Relation[]>()

  /** 엔티티(노드)를 그래프에 등록한다. */
  addEntity(entity: Entity): this {
    this.entities.set(entity.name, entity)
    if (!this.outgoing.has(entity.name)) this.outgoing.set(entity.name, [])
    if (!this.incoming.has(entity.name)) this.incoming.set(entity.name, [])
    return this
  }

  /** 두 엔티티 사이의 관계(엣지/트리플)를 등록한다. */
  addRelation(source: string, relation: string, target: string): this {
    const rel: Relation = { source, relation, target }

    // 등록되지 않은 엔티티가 들어오면 기본 엔티티로 자동 생성
    if (!this.entities.has(source)) {
      this.addEntity({ id: `e-${source}`, name: source, type: "Unknown" })
    }
    if (!this.entities.has(target)) {
      this.addEntity({ id: `e-${target}`, name: target, type: "Unknown" })
    }

    this.outgoing.get(source)!.push(rel)
    this.incoming.get(target)!.push(rel)
    return this
  }

  /**
   * 특정 엔티티를 기준으로 n-hop 연결된 모든 관계(트리플)를 탐색한다 (BFS).
   *
   * [초보자 설명] BFS(너비 우선 탐색)는 "가까운 것부터 차례로" 퍼져나가는 방식이다.
   * 시작 노드에서 1다리 건너인 것을 전부 본 다음, 2다리 건너인 것을 전부 보는 식이다.
   * (반대인 DFS 는 한 방향으로 끝까지 파고들었다가 돌아온다.)
   * 여기서 BFS 를 쓰는 이유는 "가까운 관계일수록 질문과 관련 있을 가능성이 높기" 때문이고,
   * 덤으로 각 노드에 처음 도달했을 때의 깊이가 곧 최단 거리라는 성질도 공짜로 얻는다.
   *
   * 세 가지 자료구조가 나오는데 역할이 다르다.
   *   queue        : 앞으로 방문할 노드 대기줄. 앞에서 꺼내고 뒤에 넣는다(선입선출).
   *   visited      : 이미 대기줄에 넣은 노드. 없으면 A→B→A→B 로 무한히 맴돈다.
   *   visitedEdges : 이미 결과에 담은 관계. 같은 관계가 두 번 담기는 걸 막는다.
   *                  (노드 중복과 관계 중복은 별개라 따로 관리해야 한다)
   *
   * maxDepth 는 몇 다리까지 건너갈지다. 크게 잡으면 관련 없는 정보까지 딸려온다.
   */
  traverse(startName: string, maxDepth = 2): Triple[] {
    const visited = new Set<string>()
    const queue: Array<{ name: string; depth: number }> = [{ name: startName, depth: 0 }]
    const result: Triple[] = []
    const visitedEdges = new Set<string>()

    visited.add(startName)

    while (queue.length > 0) {
      // [자바 노트] shift() 는 배열 맨 앞을 꺼낸다. Queue.poll() 자리다.
      //            끝에 붙이는 push() 는 offer() 에 해당한다.
      //            뒤의 ! 는 "비어있지 않다고 확신한다"는 표시다(while 조건이 보장해준다).
      const { name, depth } = queue.shift()!
      // 이미 최대 깊이에 도달한 노드에서는 더 뻗어나가지 않는다.
      if (depth >= maxDepth) continue

      // 순방향 탐색 (source -> target)
      const outRels = this.outgoing.get(name) ?? []
      for (const r of outRels) {
        const edgeKey = `${r.source}->${r.relation}->${r.target}`
        if (!visitedEdges.has(edgeKey)) {
          visitedEdges.add(edgeKey)
          result.push({ source: r.source, relation: r.relation, target: r.target, depth: depth + 1 })
        }
        if (!visited.has(r.target)) {
          visited.add(r.target)
          queue.push({ name: r.target, depth: depth + 1 })
        }
      }

      // 역방향 탐색 (target <- source) - 연결된 맥락을 빠짐없이 수집
      // [초보자 설명] 관계에는 방향이 있지만(A --위치--> B), 탐색은 양방향으로 한다.
      // "에스메랄다 농장의 위치는?" 은 순방향이지만,
      // "보케테 고지대에 있는 농장은?" 은 같은 관계를 거꾸로 타고 가야 답할 수 있다.
      // 그래서 outgoing 뿐 아니라 incoming 도 함께 훑는다.
      const inRels = this.incoming.get(name) ?? []
      for (const r of inRels) {
        const edgeKey = `${r.source}->${r.relation}->${r.target}`
        if (!visitedEdges.has(edgeKey)) {
          visitedEdges.add(edgeKey)
          result.push({ source: r.source, relation: r.relation, target: r.target, depth: depth + 1 })
        }
        if (!visited.has(r.source)) {
          visited.add(r.source)
          queue.push({ name: r.source, depth: depth + 1 })
        }
      }
    }

    return result
  }

  /**
   * 질문 텍스트나 키워드에서 매칭되는 엔티티들을 찾아 n-hop 관계들을 수집한다.
   */
  search(query: string, maxDepth = 2): Triple[] {
    const matchedEntities: string[] = []
    for (const name of this.entities.keys()) {
      if (query.includes(name)) {
        matchedEntities.push(name)
      }
    }

    const allTriples: Triple[] = []
    const seen = new Set<string>()

    for (const name of matchedEntities) {
      const triples = this.traverse(name, maxDepth)
      for (const t of triples) {
        const key = `${t.source}-${t.relation}-${t.target}`
        if (!seen.has(key)) {
          seen.add(key)
          allTriples.push(t)
        }
      }
    }

    return allTriples
  }

  /**
   * 지식 그래프 트리플들을 LLM이나 리랭커가 이해하기 쉬운 서술형 문장(Fact)으로 변환한다.
   */
  static triplesToFacts(triples: Triple[]): string[] {
    return triples.map((t) => {
      // 엔티티와 관계를 명확한 사실 진술문 형태로 포맷팅
      return `[지식 그래프 Fact] "${t.source}"의 ${t.relation}은(는) "${t.target}"이다.`
    })
  }
}
