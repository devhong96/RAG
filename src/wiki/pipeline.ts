import type { Collection } from "chromadb"
import { splitByHeaders, type HeadingBlock } from "../lib/chunking/structural.js"
import { chunkText } from "../lib/chunking/fixed.js"
import type { WikiArticle } from "./corpus.js"

/** 위키 실습이 쓰는 컬렉션 이름. */
export const WIKI_COLLECTION = "llm-wiki"

/** 한 청크가 가질 최대 글자 수. 문단이 이보다 길면 문장 경계에서 더 쪼갠다. */
const CHUNK_SIZE = 500

/**
 * 본문이 아닌 부속 절. 인제스트에서 제외한다.
 *
 * [초보자 설명] 위키백과 문서 끝에는 "각주", "외부 링크" 같은 절이 붙는데,
 * 내용은 거의 링크와 서지 정보뿐이라 질문에 답할 근거가 되지 못한다.
 * 그런데도 벡터 DB 에 들어가면 검색 상위 자리를 차지해 진짜 근거를 밀어낸다.
 * 인제스트 단계에서 쓸모없는 텍스트를 걸러내는 것이 청킹 전략만큼이나 검색 품질에 영향을 준다.
 */
const NOISE_HEADINGS = ["같이 보기", "각주", "참고 문헌", "참고 자료", "외부 링크", "출처"]

/** 첫 헤딩 앞의 리드 문단에 붙일 절 이름. */
const LEAD_HEADING = "개요"

export interface WikiChunk {
  id: string
  /** 실제로 임베딩되는 텍스트. 헤딩 경로가 앞에 붙어 있다. */
  text: string
  metadata: {
    source: string
    title: string
    heading: string
    chunkIdx: number
  }
}

/**
 * 첫 헤딩 앞의 리드 문단까지 챙겨서 절 단위로 나눈다.
 *
 * [초보자 설명] splitByHeaders 는 헤딩을 만난 뒤부터 본문을 모으기 때문에,
 * 첫 헤딩보다 앞에 있는 글은 어느 절에도 속하지 못하고 버려진다.
 * 그런데 위키백과 문서는 항상 "워드 임베딩은 단어를 표현하는 방식이다" 같은
 * 정의 문단으로 시작한다. 즉 질문에 답할 때 가장 쓸모 있는 문단이 통째로 사라진다.
 * 그래서 여기서 리드 문단을 '개요' 절로 따로 떼어 앞에 붙여준다.
 * (문서에 이미 '개요' 절이 있으면 그 절의 앞부분으로 합친다.)
 */
function splitWithLead(markdown: string): HeadingBlock[] {
  const firstHeading = markdown.search(/^#{1,6}\s+/m)
  const lead = (firstHeading === -1 ? markdown : markdown.slice(0, firstHeading)).trim()
  const blocks = firstHeading === -1 ? [] : splitByHeaders(markdown.slice(firstHeading))

  if (!lead) return blocks
  const first = blocks[0]
  if (first && first.heading.trim() === LEAD_HEADING) {
    return [{ heading: LEAD_HEADING, body: `${lead}\n${first.body}` }, ...blocks.slice(1)]
  }
  return [{ heading: LEAD_HEADING, body: lead }, ...blocks]
}

/**
 * 위키 문서를 "제목 계층을 살린" 청크로 자른다.
 *
 * [초보자 설명] 왜 청크 앞에 `대규모 언어 모델 > 토큰과 컨텍스트 윈도` 같은 줄을 붙이는가?
 * 문단 본문만 잘라서 임베딩하면, 예를 들어 "이 값이 0에 가까울수록 더 비슷하다는 뜻이다"
 * 같은 문장은 무엇에 대한 이야기인지 벡터에 전혀 남지 않는다. 사람이 읽을 때는 위쪽 제목을
 * 보고 알지만, 임베딩 모델은 넘겨준 글자만 본다.
 * 그래서 청크마다 "어느 문서의 어느 절인지"를 한 줄 붙여준다. 이걸 문맥 보강(contextual
 * chunking)이라고 하며, 큰 비용 없이 검색 품질을 눈에 띄게 올려주는 기법이다.
 *
 * heading 을 메타데이터로도 남기므로 나중에 `where: { heading: "..." }` 필터에도 쓸 수 있다.
 */
export function chunkWikiArticle(article: WikiArticle): WikiChunk[] {
  const sections = splitWithLead(article.markdown).filter(
    (b) => !NOISE_HEADINGS.includes(b.heading.trim()),
  )

  const chunks: WikiChunk[] = []
  for (const section of sections) {
    for (const piece of chunkText(section.body.trim(), CHUNK_SIZE)) {
      const idx = chunks.length
      chunks.push({
        id: `${article.url}#${idx}`,
        text: `${article.title} > ${section.heading}\n${piece}`,
        metadata: {
          source: article.url,
          title: article.title,
          heading: section.heading,
          chunkIdx: idx,
        },
      })
    }
  }
  return chunks
}

/**
 * 문서들을 청킹해서 컬렉션에 적재한다.
 *
 * id 를 `문서주소#순번` 으로 고정해 두었으므로 같은 문서를 다시 넣으면 upsert 로 덮어쓴다.
 * 다만 문서가 짧아져 청크 수가 줄면 예전 뒤쪽 청크가 남으므로, 먼저 그 출처의 것을 지운다.
 * (`src/lib/documents.ts` 의 ingestDocument 와 같은 이유다.)
 */
export async function ingestWikiArticles(
  collection: Collection,
  articles: WikiArticle[],
): Promise<WikiChunk[]> {
  const all: WikiChunk[] = []

  for (const article of articles) {
    const chunks = chunkWikiArticle(article)
    if (chunks.length === 0) continue

    await collection.delete({ where: { source: article.url } })
    await collection.upsert({
      ids: chunks.map((c) => c.id),
      documents: chunks.map((c) => c.text),
      metadatas: chunks.map((c) => c.metadata),
    })

    console.log(`  적재: ${article.title} → ${chunks.length}개 청크`)
    all.push(...chunks)
  }

  return all
}
