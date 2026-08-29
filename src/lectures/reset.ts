import { client } from "../lib/chroma.js"
import { EXAMPLE_COLLECTIONS } from "../lib/collections.js"

/**
 * 이 저장소의 예제가 만든 컬렉션을 지운다. (`npm run reset`)
 *
 * [초보자 설명] 예전에는 서버에 있는 컬렉션을 전부 지웠는데, 그건 위험하다.
 * Chroma 서버 하나를 다른 프로젝트와 같이 쓰고 있으면 남의 데이터까지 날아가기 때문이다.
 * 지금은 src/lib/collections.ts 의 EXAMPLE_COLLECTIONS 목록에 있는 것만 지우고,
 * 목록에 없는 컬렉션은 손대지 않은 채 화면에 알려준다.
 *
 * 정말로 전부 지우고 싶다면: npm run reset -- --all
 */
// [자바 노트] process.argv 는 자바 main(String[] args) 의 args 자리다.
//            다만 앞의 두 개가 node 실행 경로와 스크립트 경로라서 slice(2) 로 잘라낸다.
const args = process.argv.slice(2)
const deleteAll = args.includes("--all")

const existing = (await client.listCollections()).map((c) => c.name)

if (existing.length === 0) {
  console.log("지울 컬렉션이 없습니다.")
} else {
  // [자바 노트] Set 은 자바의 HashSet 과 같다. has() 로 포함 여부를 O(1) 에 확인한다.
  //            배열의 includes() 를 반복문 안에서 쓰면 매번 전체를 훑어 느려진다.
  const known = new Set(EXAMPLE_COLLECTIONS)
  const targets = deleteAll ? existing : existing.filter((name) => known.has(name))
  const skipped = deleteAll ? [] : existing.filter((name) => !known.has(name))

  if (deleteAll) {
    console.log("--all 지정: 서버의 모든 컬렉션을 지웁니다.\n")
  }

  if (targets.length === 0) {
    console.log("지울 예제 컬렉션이 없습니다.")
  } else {
    for (const name of targets) {
      await client.deleteCollection({ name })
      console.log("삭제:", name)
    }
    console.log(`\n${targets.length}개 컬렉션을 삭제했습니다.`)
  }

  if (skipped.length > 0) {
    console.log(`\n예제 목록에 없어서 그대로 둔 컬렉션 ${skipped.length}개:`)
    skipped.forEach((name) => console.log(`  • ${name}`))
    console.log("\n이 중 이 저장소가 만든 것이 있다면 src/lib/collections.ts 의")
    console.log("EXAMPLE_COLLECTIONS 목록에 추가하세요. 전부 지우려면: npm run reset -- --all")
  }
}
