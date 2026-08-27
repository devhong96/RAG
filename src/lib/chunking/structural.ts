/**
 * 문서의 구조(제목 계층)를 살려서 자르는 전략. (강의 26)
 *
 * 글자 수로 자르는 것과 달리 "무엇에 대한 내용인가"가 청크마다 유지된다.
 * heading 을 메타데이터로 넣어두면 나중에 필터링에도 쓸 수 있다.
 */
export interface HeadingBlock {
  heading: string
  body: string
}

/** 마크다운을 `#` 헤더 단위로 나눈다. */
export function splitByHeaders(markdown: string): HeadingBlock[] {
  const blocks: HeadingBlock[] = []
  let current: HeadingBlock | null = null

  for (const line of markdown.split("\n")) {
    if (/^#{1,6}\s+/.test(line)) {
      if (current) blocks.push(current)
      current = { heading: line.replace(/^#+\s+/, ""), body: "" }
    } else if (current) {
      current.body += line + "\n"
    }
  }
  if (current) blocks.push(current)

  return blocks.filter((b) => b.body.trim().length > 0)
}

/**
 * HTML 을 `<h1>~<h6>` 단위로 나눈다.
 * 정규식이라 단순한 문서에만 통한다. 실무에서는 htmlparser2 나 jsdom 을 쓴다.
 */
export function splitHtmlByHeaders(html: string): HeadingBlock[] {
  const blocks: HeadingBlock[] = []
  const regex = /<h([1-6])[^>]*>([^<]+)<\/h\1>/g
  let lastIndex = 0
  let lastHeading: string | null = null
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) !== null) {
    if (lastHeading !== null) {
      const body = html.slice(lastIndex, match.index).replace(/<[^>]+>/g, "").trim()
      if (body) blocks.push({ heading: lastHeading, body })
    }
    lastHeading = match[2] ?? ""
    lastIndex = regex.lastIndex
  }
  if (lastHeading !== null) {
    const body = html.slice(lastIndex).replace(/<[^>]+>/g, "").trim()
    if (body) blocks.push({ heading: lastHeading, body })
  }

  return blocks
}
