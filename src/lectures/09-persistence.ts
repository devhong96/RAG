import { openCollection, runExample } from "../lib/chroma.js"

/**
 * 영속성 확인 예제.
 *
 * 주의: id 를 고정해두고 add 하면 몇 번을 실행해도 count 가 1이다.
 * id 가 기본키라 중복 추가가 무시되기 때문인데, 그러면
 * "영속성이 되어서 1" 인지 "방금 넣어서 1" 인지 구분할 수 없다.
 *
 * 그래서 여기서는 (1) 먼저 이전 실행분을 세고,
 * (2) 매번 새로운 id 를 넣어서 숫자가 실제로 쌓이는지 본다.
 *
 * 서버를 껐다 켠 뒤(`npm run db`) 다시 실행해도 숫자가 이어지면 영속성이 동작하는 것이다.
 */
await runExample("[09강] 서버 재시작 후 데이터 영속성", async () => {
  const collection = await openCollection("persistence")

  const before = await collection.count()
  console.log("이전 실행까지 쌓인 문서 :", before, before === 0 ? "(첫 실행)" : "")

  const id = `run-${before + 1}`
  await collection.add({ ids: [id], documents: [`${before + 1}번째 실행에서 추가한 문서`] })

  console.log(`'${id}' 추가 후 문서 :`, await collection.count())
  console.log("\n서버를 재시작한 뒤 다시 실행해도 숫자가 이어지면 영속성이 동작하는 것이다.")
  console.log("초기화하려면: npm run reset")
})
