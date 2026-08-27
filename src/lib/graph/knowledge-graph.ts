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

  /** 특정 엔티티를 기준으로 n-hop 연결된 모든 관계(트리플)를 탐색한다 (BFS). */
  traverse(startName: string, maxDepth = 2): Triple[] {
    const visited = new Set<string>()
    const queue: Array<{ name: string; depth: number }> = [{ name: startName, depth: 0 }]
    const result: Triple[] = []
    const visitedEdges = new Set<string>()

    visited.add(startName)

    while (queue.length > 0) {
      const { name, depth } = queue.shift()!
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
