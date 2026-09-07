import { longDocs } from "../data/sample-docs.js"
import { runExample } from "../lib/chroma.js"
import { formatCitationWarning } from "../lib/citations.js"
import { ingestDocument } from "../lib/documents.js"
import { judgeAnswer, summarize, type JudgeScore } from "../lib/eval/judge.js"
import { answerQuestion, RAG_COLLECTION } from "../lib/rag.js"

/**
 * 답변 품질 평가 — `npm run eval:answer`
 *
 * 검색 지표(Recall/MRR)만으로는 안 보이는 것을 본다.
 * 질문마다 RAG 답변을 만들고, 인용 표기를 코드로 검사한 뒤(패턴 11),
 * 심판형 LLM 으로 근거성과 관련성을 채점한다(패턴 17).
 *
 * 마지막 질문은 일부러 자료에 답이 없는 것을 넣었다.
 * "모른다고 답할 수 있는가"가 RAG 에서 정답을 맞히는 것만큼 중요하기 때문이다.
 * 여기서 그럴듯한 답을 지어내면 근거성 점수가 떨어지고, 그게 이 평가의 핵심 관찰 지점이다.
 */
const QUESTIONS: readonly string[] = [
  "에티오피아 원두는 어떤 향이 나나요?",
  "워시드 가공 방식은 어떤 특징이 있나요?",
  "전기차 완속 충전기는 완충까지 얼마나 걸리나요?",
  "커피 원두를 냉장 보관하면 곰팡이가 생기나요?", // 자료에 없는 질문
]

await runExample("답변 품질 평가 (인용 검증 + 심판형 LLM)", async () => {
  console.log("[1] 평가용 자료 인제스트")
  for (const doc of longDocs) {
    const { chunkCount, stats } = await ingestDocument(RAG_COLLECTION, {
      source: doc.source,
      text: doc.body,
      metadata: { title: doc.title },
    })
    console.log(`  ${doc.title}: ${chunkCount}개 청크 (${stats.changed}개 재임베딩)`)
  }

  console.log("\n[2] 질문별 답변 생성 및 채점")
  const scores: (JudgeScore | null)[] = []

  for (const question of QUESTIONS) {
    const { answer, sources, citations } = await answerQuestion(question, 3)

    console.log(`\n질문: ${question}`)
    console.log(`답변: ${answer.replace(/\n/g, " ")}`)

    // 값싼 검사를 먼저 건다. LLM 을 부르지 않고 바로 알 수 있는 문제다.
    const warning = formatCitationWarning(citations)
    console.log(`  인용: ${citations.cited.join(", ") || "없음"}${warning ? ` ← ${warning}` : ""}`)

    // 비싼 검사. 답변 하나당 LLM 호출이 한 번 더 들어간다.
    const score = await judgeAnswer({
      question,
      answer,
      contexts: sources.map((s) => s.document),
    })
    scores.push(score)

    if (score) {
      console.log(`  근거성 ${score.groundedness}/5, 관련성 ${score.relevance}/5 - ${score.reason}`)
    } else {
      console.log("  채점 실패 (집계에서 제외)")
    }
  }

  console.log("\n[3] 집계")
  const summary = summarize(scores)
  console.log(`  채점 ${summary.judged}건 / 실패 ${summary.failed}건`)
  console.log(`  근거성 평균: ${summary.groundedness.toFixed(2)} / 5`)
  console.log(`  관련성 평균: ${summary.relevance.toFixed(2)} / 5`)
  console.log(
    "\n※ 절대 점수가 아니라 비교용입니다. 청킹이나 검색 전략을 바꾼 뒤 다시 돌려 값의 변화를 보세요.",
  )
})
