import { longDocs } from "../data/sample-docs.js"
import { resetCollection, runExample } from "../lib/chroma.js"
import { chunkText } from "../lib/chunking/fixed.js"
import { answerFromContext, parentChildSearch, trimContext } from "../lib/search/parent-child.js"

/**
 * Parent-Child Retrieval (부모-자식 검색). (강의 27, 32)
 *
 * [초보자 설명] 청킹에는 서로 충돌하는 두 가지 요구가 있다.
 *
 *   • 검색은 "작은 청크"가 유리하다.
 *     청크 하나가 벡터 하나가 되는데, 청크가 길면 여러 주제가 한 벡터에 뭉뚱그려져
 *     "이 청크가 무엇에 대한 글인지"가 흐려진다. 짧을수록 초점이 또렷해 정확히 걸린다.
 *
 *   • 답변은 "큰 청크"가 유리하다.
 *     LLM 에게 한 문장짜리 조각만 주면 앞뒤 맥락이 없어 엉뚱한 답을 한다.
 *     "그것은 88~94도가 적당하다" 만 보면 무엇이 88도인지 알 수 없다.
 *
 * 둘 다 가지려면 어떻게 할까? 문서를 두 가지 크기로 저장해두면 된다.
 *   1. 큰 덩어리(부모)를 parent-store 에 넣는다.
 *   2. 부모를 잘게 쪼갠 조각(자식)을 parent-child 에 넣되,
 *      각 자식에 "내 부모가 누구인지"(parentId)를 메타데이터로 붙인다.
 *   3. 검색은 작은 자식으로 해서 정확히 찾고,
 *   4. LLM 에는 그 자식의 부모(큰 덩어리)를 꺼내서 넘긴다.
 *
 * 즉 "찾을 때는 좁게, 읽을 때는 넓게"가 이 기법의 핵심이다.
 */

/** 문단(빈 줄) 단위로 나눈다. 여기서는 이 문단 하나가 "부모"가 된다. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

await runExample("[27·32강] Parent-Child Retrieval (작게 찾고 크게 읽기)", async () => {
  // 컬렉션 두 개를 쓴다. 하나는 큰 덩어리 보관용, 하나는 검색용 작은 조각.
  const parents = await resetCollection("parent-store")
  const children = await resetCollection("parent-child")

  const parentIds: string[] = []
  const parentDocs: string[] = []
  const childIds: string[] = []
  const childDocs: string[] = []
  // [자바 노트] Record<string, string|number> 는 Map<String, Object> 자리다.
  //            Chroma 메타데이터는 문자열/숫자/불린만 담을 수 있다.
  const childMetas: Record<string, string | number>[] = []

  for (const doc of longDocs) {
    splitParagraphs(doc.body).forEach((paragraph, pIdx) => {
      const parentId = `${doc.id}-p${pIdx}`
      parentIds.push(parentId)
      parentDocs.push(paragraph)

      // 부모 문단을 다시 120자 정도의 자식으로 쪼갠다.
      // 여기서 parentId 를 메타데이터로 심어두는 것이 이 기법의 전부다.
      // 이게 있어야 나중에 자식을 찾은 뒤 부모를 되짚어 갈 수 있다.
      chunkText(paragraph, 120).forEach((chunk, cIdx) => {
        childIds.push(`${parentId}-c${cIdx}`)
        childDocs.push(chunk)
        childMetas.push({ parentId, source: doc.source, title: doc.title })
      })
    })
  }

  await parents.upsert({ ids: parentIds, documents: parentDocs })
  await children.upsert({ ids: childIds, documents: childDocs, metadatas: childMetas })

  const avg = (xs: string[]) => Math.round(xs.reduce((a, b) => a + b.length, 0) / (xs.length || 1))
  console.log(`부모(문단) ${parentIds.length}개  평균 ${avg(parentDocs)}자`)
  console.log(`자식(조각) ${childIds.length}개  평균 ${avg(childDocs)}자\n`)

  const question = "핸드드립 물 온도는 몇 도가 적당한가요?"
  console.log(`질문: ${question}\n`)

  // --- (A) 자식만 검색했을 때: 정확히 찾지만 맥락이 없다 ---
  console.log("--- A. 자식(작은 조각)만 검색 ---")
  const childOnly = await children.query({ queryTexts: [question], nResults: 3 })
  ;(childOnly.documents[0] ?? []).forEach((d, i) => {
    console.log(`  [${i + 1}] ${d}`)
  })
  console.log("  → 질문에 딱 맞는 조각을 찾았지만, 앞뒤가 잘려 있어 그대로 답하기엔 부족하다.\n")

  // --- (B) 자식으로 찾고 부모를 꺼냈을 때 ---
  console.log("--- B. 자식으로 찾고 → 부모(문단)를 꺼냄 ---")
  const result = await parentChildSearch(children, parents, question, 3)
  console.log(`  걸린 자식 ${result.childIds.length}개 → 되짚어 간 부모 ${result.parentIds.length}개`)
  console.log(`  LLM 에 넘길 컨텍스트 길이: ${result.context.length}자`)
  console.log(`  (trimContext 가 4000자를 넘지 않게 잘라준다 — LLM 입력 한도를 지키기 위해)\n`)
  console.log(result.context.slice(0, 300) + " ...\n")

  // --- (C) 그 부모 문단을 근거로 답변 생성 ---
  console.log("--- C. 부모 문단을 근거로 LLM 답변 ---")
  const answer = await answerFromContext(result.context, question)
  console.log(answer)

  // trimContext 는 따로도 쓸 수 있다. 긴 문서 목록을 예산 안에 맞출 때 유용하다.
  const budgeted = trimContext(parentDocs, 500)
  console.log(`\n(참고) trimContext(부모 ${parentDocs.length}개, 500자 예산) → ${budgeted.length}개만 남음`)
})
