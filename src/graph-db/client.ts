import neo4j, { type Driver, type Session } from "neo4j-driver"
import { config } from "../config.js"
import type { Entity, Triple } from "../lib/graph/knowledge-graph.js"

export type { Entity, Triple }

/**
 * Neo4j 그래프 DB 클라이언트.
 */
export class Neo4jKnowledgeGraph {
  private driver: Driver

  constructor(
    url = config.neo4j.url,
    user = config.neo4j.user,
    password = config.neo4j.password,
  ) {
    this.driver = neo4j.driver(url, neo4j.auth.basic(user, password))
  }

  /** Neo4j 서버 연결 상태 확인 */
  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity()
      return true
    } catch (error) {
      console.error("Neo4j 연결 실패:", error)
      return false
    }
  }

  private getSession(): Session {
    return this.driver.session()
  }

  /** 엔티티(노드)를 Neo4j에 등록 (MERGE) */
  async addEntity(entity: Entity): Promise<void> {
    const session = this.getSession()
    try {
      await session.run(
        `
        MERGE (e:Entity {name: $name})
        SET e.id = $id,
            e.type = $type,
            e.description = $description
        `,
        {
          name: entity.name,
          id: entity.id,
          type: entity.type,
          description: entity.description ?? "",
        },
      )
    } finally {
      await session.close()
    }
  }

  /** 두 엔티티 사이의 관계(Edge)를 등록 */
  async addRelation(source: string, relation: string, target: string): Promise<void> {
    const session = this.getSession()
    try {
      await session.run(
        `
        MERGE (s:Entity {name: $source})
          ON CREATE SET s.id = 'e-' + $source, s.type = 'Unknown'
        MERGE (t:Entity {name: $target})
          ON CREATE SET t.id = 'e-' + $target, t.type = 'Unknown'
        MERGE (s)-[r:RELATION {type: $relation}]->(t)
        `,
        { source, relation, target },
      )
    } finally {
      await session.close()
    }
  }

  /** 특정 노드 기준 n-hop 연결 관계 Cypher 탐색 */
  async traverse(startName: string, maxDepth = 2): Promise<Triple[]> {
    const session = this.getSession()
    const safeDepth = Math.min(Math.max(1, Math.floor(maxDepth)), 5)

    try {
      // [초보자 설명] depth(깊이) 는 "시작 노드에서 몇 다리 건너 있는 관계인가"를 뜻한다.
      //   게이샤 --(대표 농장)--> 에스메랄다 --(위치)--> 보케테
      // 여기서 '대표 농장' 은 depth 1, '위치' 는 depth 2 여야 한다.
      //
      // 예전 쿼리는 length(path) 를 depth 로 썼는데, 이건 "그 엣지가 실려 온 경로 전체의 길이"다.
      // Neo4j 는 길이 1, 2, 3 짜리 경로를 각각 다 찾아내므로, 1-hop 인 '대표 농장' 이
      // 길이 2 경로에도 길이 3 경로에도 끼어 있어 depth 1, 2, 3 으로 세 번 나왔다.
      // (엣지 4개짜리 그래프에서 7행이 나왔다.) 그리고 아래 JS 중복 제거가 "먼저 온 것"을
      // 남기므로, 실행할 때마다 depth 값이 달라질 수 있었다.
      //
      // 고친 방식:
      //   1. UNWIND range(...) 로 경로 안에서 그 엣지가 몇 번째인지(idx)를 꺼낸다 → 위치는 idx+1
      //   2. min(depth) 로 여러 경로 중 가장 짧은 위치만 남긴다 (= 최단 거리)
      // 이러면 인메모리 BFS(KnowledgeGraph.traverse)와 결과가 정확히 같아진다.
      const result = await session.run(
        `
        MATCH path = (start:Entity {name: $startName})-[*1..${safeDepth}]-(:Entity)
        UNWIND range(0, size(relationships(path)) - 1) AS idx
        WITH relationships(path)[idx] AS rel, idx + 1 AS depth
        WITH rel, min(depth) AS depth
        RETURN startNode(rel).name AS source,
               rel.type AS relation,
               endNode(rel).name AS target,
               depth
        ORDER BY depth, source, target
        `,
        { startName },
      )

      const seen = new Set<string>()
      const triples: Triple[] = []

      for (const record of result.records) {
        const source = record.get("source") as string
        const relation = record.get("relation") as string
        const target = record.get("target") as string
        const depth = record.get("depth") as { low?: number } | number
        const depthNum = typeof depth === "number" ? depth : (depth?.low ?? 1)

        const key = `${source}->${relation}->${target}`
        if (!seen.has(key)) {
          seen.add(key)
          triples.push({
            source,
            relation,
            target,
            depth: depthNum,
          })
        }
      }

      return triples
    } finally {
      await session.close()
    }
  }

  /** 질문 내 엔티티와 매칭되는 n-hop 관계들을 수집 */
  async search(query: string, maxDepth = 2): Promise<Triple[]> {
    const session = this.getSession()
    try {
      const res = await session.run(`MATCH (e:Entity) RETURN e.name AS name`)
      const allEntityNames = res.records.map((r) => r.get("name") as string)
      const matched = allEntityNames.filter((name) => query.includes(name))

      const allTriples: Triple[] = []
      const seen = new Set<string>()

      for (const entityName of matched) {
        const triples = await this.traverse(entityName, maxDepth)
        for (const t of triples) {
          const key = `${t.source}-${t.relation}-${t.target}`
          if (!seen.has(key)) {
            seen.add(key)
            allTriples.push(t)
          }
        }
      }

      return allTriples
    } finally {
      await session.close()
    }
  }

  /** 현재 저장된 노드 및 관계 통계 조회 */
  async getStatistics(): Promise<{
    nodeCount: number
    relationCount: number
    entities: string[]
    relations: Array<{ source: string; relation: string; target: string }>
  }> {
    const session = this.getSession()
    try {
      const nodeCountRes = await session.run(`MATCH (n:Entity) RETURN count(n) AS cnt`)
      const relCountRes = await session.run(`MATCH ()-[r:RELATION]->() RETURN count(r) AS cnt`)

      const nodeCount = Number(nodeCountRes.records[0]?.get("cnt") ?? 0)
      const relationCount = Number(relCountRes.records[0]?.get("cnt") ?? 0)

      const entitiesRes = await session.run(`MATCH (n:Entity) RETURN n.name AS name ORDER BY n.name`)
      const entities = entitiesRes.records.map((r) => r.get("name") as string)

      const relsRes = await session.run(
        `MATCH (s:Entity)-[r:RELATION]->(t:Entity) RETURN s.name AS s, r.type AS r, t.name AS t LIMIT 30`,
      )
      const relations = relsRes.records.map((rec) => ({
        source: rec.get("s") as string,
        relation: rec.get("r") as string,
        target: rec.get("t") as string,
      }))

      return { nodeCount, relationCount, entities, relations }
    } finally {
      await session.close()
    }
  }

  /** 트리플 목록을 Fact 진술문으로 변환 */
  static triplesToFacts(triples: Triple[]): string[] {
    return triples.map(
      (t) => `[지식 그래프 Fact] "${t.source}"의 ${t.relation}은(는) "${t.target}"이다.`,
    )
  }

  /** 전체 초기화 */
  async clear(): Promise<void> {
    const session = this.getSession()
    try {
      await session.run(`MATCH (n:Entity) DETACH DELETE n`)
    } finally {
      await session.close()
    }
  }

  /** 연결 종료 */
  async close(): Promise<void> {
    await this.driver.close()
  }
}
