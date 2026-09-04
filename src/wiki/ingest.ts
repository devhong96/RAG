import { openCollection, resetCollection, runExample } from "../lib/chroma.js"
import { WIKI_TITLES } from "./corpus.js"
import { loadWikiArticles } from "./fetch.js"
import { ingestWikiArticles, WIKI_COLLECTION } from "./pipeline.js"

/**
 * [위키 스크립트 1] 위키백과 문서를 받아 구조 청킹 후 Chroma 에 적재한다.
 *
 *   npm run wiki:ingest                       # 기본 3개 문서
 *   npm run wiki:ingest -- 파인_튜닝 어텐션    # 원하는 문서 제목 지정
 *   npm run wiki:ingest -- --offline          # 네트워크 없이 로컬 사본만 사용
 *   npm run wiki:ingest -- --reset            # 컬렉션을 비우고 처음부터 적재
 *
 * 같은 문서를 다시 넣어도 중복되지 않는다(출처 기준으로 지우고 다시 넣는다).
 * 다만 온라인 문서와 로컬 사본은 출처 주소가 서로 달라 같은 문서로 인식되지 않는다.
 * 두 방식을 오갈 때는 `--reset` 으로 한 번 비워주는 편이 헷갈리지 않는다.
 */
await runExample("위키백과 문서 인제스트 (내려받기 → 구조 청킹 → 벡터 적재)", async () => {
  // [자바 노트] process.argv 는 자바의 main(String[] args) 자리다.
  //            앞의 두 개(node 실행 경로, 스크립트 경로)는 빼고 쓴다.
  const args = process.argv.slice(2)
  const offline = args.includes("--offline")
  const reset = args.includes("--reset")
  const titles = args.filter((a) => !a.startsWith("--"))
  const targets = titles.length > 0 ? titles : [...WIKI_TITLES]

  console.log(`[1] 문서 확보 (${offline ? "로컬 사본" : "위키백과 API"})`)
  const { articles, usedFallback } = await loadWikiArticles(targets, { offline })
  articles.forEach((a) => console.log(`  - ${a.title} (${a.markdown.length}자)`))
  if (usedFallback && !offline) {
    console.log("  ※ 일부 문서는 네트워크 문제로 로컬 사본을 사용했습니다.")
  }

  console.log(`\n[2] 구조 청킹 후 '${WIKI_COLLECTION}' 컬렉션에 적재`)
  const collection = reset
    ? await resetCollection(WIKI_COLLECTION)
    : await openCollection(WIKI_COLLECTION)
  if (reset) console.log("  (--reset: 기존 청크를 모두 비웠습니다)")
  const chunks = await ingestWikiArticles(collection, articles)

  console.log(`\n총 ${chunks.length}개 청크 적재 완료. 이제 아래 명령으로 질문해 보세요.`)
  console.log(`  npm run wiki:search -- "셀프 어텐션이 뭔가요?"`)
})
