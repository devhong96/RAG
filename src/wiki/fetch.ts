import { LOCAL_WIKI_ARTICLES, type WikiArticle } from "./corpus.js"

/**
 * 한국어 위키백과에서 문서 본문을 받아온다.
 *
 * [초보자 설명] 위키백과는 별도 키 없이 쓸 수 있는 공개 API 를 제공한다.
 * `action=query&prop=extracts&explaintext=1` 로 요청하면 HTML 태그가 제거된
 * 순수 텍스트 본문이 오는데, 이때 문단 제목은 `== 제목 ==` 형태로 남는다.
 * 이 저장소의 구조 청킹기(splitByHeaders)는 마크다운 `##` 을 기준으로 자르므로,
 * 아래에서 `== 제목 ==` 을 `## 제목` 으로 바꿔주면 그대로 재사용할 수 있다.
 */
const WIKI_API = "https://ko.wikipedia.org/w/api.php"

/** 위키미디어는 요청자를 식별할 수 있는 User-Agent 를 요구한다. */
const USER_AGENT = "rag-study-example/1.0 (https://github.com/devhong96/RAG; educational use)"

/** API 응답에서 우리가 실제로 쓰는 부분만 적은 타입. */
interface WikiApiResponse {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: string }>
  }
}

/**
 * `== 제목 ==` / `=== 소제목 ===` 을 마크다운 헤딩으로 바꾼다.
 * `=` 개수가 곧 깊이이므로 그대로 `#` 개수로 옮긴다.
 */
export function wikitextToMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const match = /^(={2,6})\s*(.+?)\s*\1$/.exec(line.trim())
      if (!match) return line
      const depth = match[1]?.length ?? 2
      return `${"#".repeat(depth)} ${match[2]}`
    })
    .join("\n")
}

/** 문서 하나를 받아온다. 없는 문서면 null. */
async function fetchOne(title: string, signal: AbortSignal): Promise<WikiArticle | null> {
  const url = new URL(WIKI_API)
  url.search = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1", // "LLM" 처럼 넘겨주기 문서로 들어와도 본문까지 따라간다
    format: "json",
    titles: title,
  }).toString()

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal })
  if (!response.ok) throw new Error(`위키백과 응답 오류 (${response.status})`)

  const data = (await response.json()) as WikiApiResponse
  // pages 는 { "12345": {...} } 처럼 페이지 ID 를 키로 갖는다. 키 이름을 모르니 값만 꺼낸다.
  const page = Object.values(data.query?.pages ?? {})[0]
  if (!page || page.missing !== undefined || !page.extract?.trim()) return null

  const resolvedTitle = page.title ?? title
  return {
    title: resolvedTitle,
    url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/ /g, "_"))}`,
    markdown: wikitextToMarkdown(page.extract),
  }
}

/**
 * 제목 목록을 받아 위키백과에서 내려받되, 네트워크가 막혔거나 문서가 없으면
 * 같은 주제의 로컬 사본으로 대체한다. 실습이 네트워크 상태에 좌우되지 않게 하기 위함이다.
 *
 * [자바 노트] AbortSignal.timeout(ms) 은 지정 시간이 지나면 fetch 를 취소한다.
 *            자바의 HttpClient.timeout(Duration) 과 같은 역할이다.
 *            이게 없으면 응답 없는 네트워크에서 스크립트가 무한정 멈춘다.
 */
export async function loadWikiArticles(
  titles: readonly string[],
  { offline = false, timeoutMs = 10_000 }: { offline?: boolean; timeoutMs?: number } = {},
): Promise<{ articles: WikiArticle[]; usedFallback: boolean }> {
  if (offline) return { articles: pickLocal(titles), usedFallback: true }

  const articles: WikiArticle[] = []
  let usedFallback = false

  for (const title of titles) {
    try {
      const fetched = await fetchOne(title, AbortSignal.timeout(timeoutMs))
      if (fetched) {
        articles.push(fetched)
        continue
      }
      console.warn(`  ! 위키백과에 '${title}' 문서가 없습니다. 로컬 사본을 사용합니다.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`  ! '${title}' 내려받기 실패(${message}). 로컬 사본을 사용합니다.`)
    }
    const local = findLocal(title)
    if (local) {
      articles.push(local)
      usedFallback = true
    }
  }

  // 하나도 못 받았다면(예: 네트워크 전면 차단) 로컬 코퍼스 전체로 진행한다.
  if (articles.length === 0) return { articles: pickLocal(titles), usedFallback: true }

  return { articles, usedFallback }
}

function findLocal(title: string): WikiArticle | undefined {
  return LOCAL_WIKI_ARTICLES.find((a) => a.title === title)
}

function pickLocal(titles: readonly string[]): WikiArticle[] {
  const picked = titles.map(findLocal).filter((a): a is WikiArticle => a !== undefined)
  return picked.length > 0 ? picked : LOCAL_WIKI_ARTICLES
}
