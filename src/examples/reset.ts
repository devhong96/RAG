import { client } from "../lib/chroma.js"

/** 예제로 만든 컬렉션을 전부 지운다. */
const collections = await client.listCollections()
if (collections.length === 0) {
  console.log("지울 컬렉션이 없습니다.")
} else {
  for (const c of collections) {
    await client.deleteCollection({ name: c.name })
    console.log("삭제:", c.name)
  }
}
