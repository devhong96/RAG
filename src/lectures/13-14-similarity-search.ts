import { resetCollection, runExample } from "../lib/chroma.js"

/** 벡터 검색의 핵심 — 의미가 비슷한 문서를 찾아온다. */
await runExample("[13~14강] 의미 검색과 코사인 거리", async () => {
  const collection = await resetCollection("similarity-search")

  await collection.add({
    ids: ["d1", "d2", "d3", "d4"],
    documents: [
      "커피는 카페인이 들어 있어 잠을 깨워준다.",
      "녹차에도 카페인이 있지만 커피보다 적다.",
      "고양이는 하루에 16시간을 잔다.",
      "파이썬은 배우기 쉬운 프로그래밍 언어다.",
    ],
  })

  const results = await collection.query({
    queryTexts: ["잠이 안 오게 하는 음료가 뭐야?"],
    nResults: 3,
  })

  console.log("질문: 잠이 안 오게 하는 음료가 뭐야?\n")
  // [자바 노트] forEach 는 자바 스트림의 forEach 와 같다.
  //            documents[0] 뒤의 "?." 는 값이 없으면 통째로 건너뛴다는 뜻 (NPE 방지).
  results.documents[0]?.forEach((doc, i) => {
    const distance = results.distances?.[0]?.[i]
    console.log(`${i + 1}위 (거리 ${distance?.toFixed(4)}) ${doc}`)
  })

  console.log("\n거리가 작을수록 가깝다.")
  console.log("주목: '고양이는 16시간을 잔다'가 상위권에 올라올 수 있다.")
  console.log("'잠'이라는 표현이 겹쳐서인데, 임베딩은 의미를 보되 완벽하지는 않다는 뜻이다.")
  console.log("실제 RAG 에서는 metadata 필터나 rerank 를 덧붙여 이런 오탐을 걸러낸다.")
})
