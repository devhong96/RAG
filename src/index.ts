/**
 * 자유 실습용 스크래치 파일 (`npm start`).
 *
 * 정리된 예제는 src/lectures/ 에 있다. `npm run` 으로 목록을 볼 수 있다.
 * 여기서는 부담 없이 이것저것 시도해보고, 쓸 만해지면 lectures/ 로 옮기면 된다.
 *
 * [자바 노트] Node/TypeScript 가 처음이라면 docs/05-reference/자바개발자를-위한-노트.md 를 먼저 보자.
 * import 경로에 ".js" 를 쓰는 이유, main 메서드가 없는 이유 등을 정리해 두었다.
 */
import { resetCollection, runExample } from "./lib/chroma.js"

await runExample("스크래치", async () => {
  const collection = await resetCollection("scratch")

  await collection.add({
    ids: ["doc-1"],
    documents: ["커피는 마음의 안식이다."],
  })

  console.log("저장된 문서 갯수 :", await collection.count())
})
