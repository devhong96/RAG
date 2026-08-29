import { EMBEDDING_DIM } from "../config.js"
import { resetCollection, runExample } from "../lib/chroma.js"

/**
 * 임베딩 함수가 "언제" 호출되는지 확인하는 예제.
 *
 *   documents / queryTexts      → 임베딩 함수가 자동 호출됨
 *   embeddings / queryEmbeddings → 임베딩 함수는 호출되지 않음
 */
await runExample("[10강] 임베딩 함수 호출 시점 확인", async () => {
  const collection = await resetCollection("embedding-timing")

  await collection.upsert({
    ids: ["auto"],
    documents: ["임베딩 함수가 호출되어 벡터가 만들어진다."],
  })

  const dummy = Array.from({ length: EMBEDDING_DIM }, () => 0)
  await collection.upsert({
    ids: ["manual"],
    documents: ["벡터는 내가 직접 만들었다."],
    embeddings: [dummy],
  })

  const result = await collection.get({
    ids: ["auto", "manual"],
    include: ["embeddings"] as const,
  })

  // [초보자 설명] 여기서 흔히 하는 실수가 있다.
  // ids: ["auto", "manual"] 로 요청했으니 결과도 그 순서로 오겠거니 하고
  // embeddings[0] 을 auto, embeddings[1] 을 manual 이라고 단정하기 쉽다.
  // 하지만 Chroma 는 "요청한 id 순서대로 돌려준다"고 보장하지 않는다.
  // 지금은 우연히 맞을 뿐이고(알파벳순으로 auto 가 manual 보다 앞), id 이름을 바꾸면 뒤바뀐다.
  //
  // 그래서 순서를 믿지 말고, 돌려받은 result.ids 에서 원하는 id 의 위치를 찾아 써야 한다.
  // [자바 노트] indexOf 는 자바의 List.indexOf 와 같다. 없으면 -1 을 돌려준다.
  const at = (id: string) => {
    const index = result.ids.indexOf(id)
    return index === -1 ? undefined : result.embeddings?.[index]?.slice(0, 5)
  }

  console.log("auto   (documents 만 전달) :", at("auto"))
  console.log("manual (embeddings 직접 전달) :", at("manual"))
  console.log("\nmanual 쪽이 0 벡터인 것은 임베딩 함수가 호출되지 않았다는 뜻이다.")
  console.log("(참고: 실제 응답 순서는", result.ids, "였다. 요청 순서와 다를 수 있다.)")
})
