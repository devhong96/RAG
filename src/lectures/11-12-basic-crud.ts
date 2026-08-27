import { resetCollection, runExample } from "../lib/chroma.js"

/**
 * [자바 노트] 이 파일에는 main 메서드도 클래스도 없다.
 * 파일 최상위에서 바로 await 를 쓸 수 있다 (top-level await).
 * 자바에는 없는 문법이니 처음엔 어색할 수 있다.
 *
 * async () => { ... } 는 자바의 람다 () -> { ... } 와 같고,
 * async 가 붙어서 Promise 를 반환한다.
 */
await runExample("[11~12강] 기본 CRUD (add / get / where / update / delete)", async () => {
  const collection = await resetCollection("basic-crud")

  // [자바 노트] 인자를 순서대로 넘기지 않고 객체 하나로 넘긴다.
  //            자바의 빌더 패턴 자리라고 보면 된다. 이름이 있어서 순서를 외울 필요가 없다.
  // add: documents 를 넘기면 임베딩 함수가 자동으로 호출된다.
  await collection.add({
    ids: ["doc-1", "doc-2"],
    documents: ["커피는 마음의 안식이다.", "홍차는 오후의 여유다."],
    metadatas: [{ category: "coffee" }, { category: "tea" }],
  })
  console.log("추가 후 count :", await collection.count())

  // id 는 기본키다. 같은 id 로 또 add 해도 개수는 늘지 않는다.
  await collection.upsert({ ids: ["doc-1"], documents: ["커피는 마음의 안식이다."] })
  console.log("같은 id upsert 후 count :", await collection.count(), "(안 늘어남)")

  // get: id 나 조건으로 꺼낸다.
  const fetched = await collection.get({ ids: ["doc-1"] })
  console.log("get(doc-1) :", fetched.documents)

  // where 로 메타데이터 필터링
  const tea = await collection.get({ where: { category: "tea" } })
  console.log("where(category=tea) :", tea.documents)

  // update: 내용만 바꾼다.
  await collection.update({ ids: ["doc-2"], documents: ["홍차는 밤에도 좋다."] })
  console.log("update 후 :", (await collection.get({ ids: ["doc-2"] })).documents)

  // delete
  await collection.delete({ ids: ["doc-2"] })
  console.log("delete 후 count :", await collection.count())
})
