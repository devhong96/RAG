/**
 * 인용 검증 — "자료에 근거했다"를 확인 가능한 형태로 만든다. (패턴 11: 신뢰할 수 있는 생성)
 *
 * [초보자 설명] 지금까지 이 저장소의 RAG 프롬프트는 이렇게 부탁하고 있었다.
 *   "자료 어디에도 근거가 없을 때만 답할 수 없다고 하세요"
 *   "자료에 없는 정보는 덧붙이지 마세요"
 *
 * 문제는 이걸 **지켰는지 아무도 확인하지 않는다**는 것이다. 모델이 자료 세 개를 받아놓고
 * 학습 때 외운 지식으로 답해도 화면에는 똑같이 그럴듯한 문장이 나온다. 출처 목록도 같이
 * 찍히니 오히려 더 믿음직해 보인다. 근거 없는 답에 근거가 붙어 있는 셈이라 더 위험하다.
 *
 * 그래서 두 가지를 바꾼다.
 *   1. 모델에게 문장마다 `[자료 N]` 표기를 달게 한다 (프롬프트 규칙)
 *   2. 그 표기를 **코드로 검사한다** (이 파일)
 *
 * 2번이 핵심이다. 1번만 하면 여전히 부탁이고, 모델은 아무 번호나 붙일 수도 있다.
 * 실제로 자주 보는 실패가 자료는 3개를 줬는데 `[자료 5]` 를 인용하는 것이다.
 * 검사하면 이런 것이 바로 드러난다.
 *
 * **주의: 이건 사실 검증이 아니다.** 인용 번호가 실재하는지, 인용이 아예 없지는 않은지만 본다.
 * "그 자료가 정말 그 내용을 담고 있는가"는 이 검사로 못 잡고, 그건 심판형 LLM
 * (`eval/judge.ts`) 의 몫이다. 값싼 검사와 비싼 검사를 나눠 두고, 값싼 것부터 거는 구조다.
 */

/** 답변에서 인용 표기를 찾는 정규식. `[자료 1]`, `[자료1]`, `[자료 1, 2]` 를 모두 잡는다. */
const CITATION_PATTERN = /\[자료\s*([\d\s,]+)\]/g

export interface CitationCheck {
  /** 답변이 실제로 인용한 자료 번호(1부터). 중복 없이 오름차순. */
  cited: number[]
  /** 존재하지 않는 자료를 가리킨 번호. 비어 있어야 정상이다. */
  invalid: number[]
  /** 인용이 하나도 없는가. 근거 없이 답했을 가능성이 높다는 신호. */
  missing: boolean
}

/**
 * 답변의 인용 표기를 검사한다.
 *
 * 순수 함수이므로 LLM 없이 테스트할 수 있다.
 *
 * @param answer LLM 이 만든 답변 문자열
 * @param sourceCount 실제로 넘겨준 자료 개수. 이보다 큰 번호는 지어낸 것이다.
 */
export function checkCitations(answer: string, sourceCount: number): CitationCheck {
  const found = new Set<number>()

  // [자바 노트] matchAll 은 자바의 Matcher.find() 반복문 자리다.
  //            결과가 이터레이터라 스프레드(...)로 배열로 편다.
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    // `[자료 1, 2]` 처럼 한 괄호에 여러 개가 들어올 수 있어 쉼표로 다시 나눈다.
    for (const piece of (match[1] ?? "").split(",")) {
      const n = Number(piece.trim())
      if (Number.isInteger(n) && n > 0) found.add(n)
    }
  }

  const cited = [...found].sort((a, b) => a - b)
  return {
    cited,
    invalid: cited.filter((n) => n > sourceCount),
    missing: cited.length === 0,
  }
}

/**
 * 검사 결과를 사람이 읽을 한 줄로 만든다. 로그와 CLI 출력에 쓴다.
 * 문제가 없으면 빈 문자열을 돌려주므로, 호출부에서 이상할 때만 찍을 수 있다.
 */
export function formatCitationWarning(check: CitationCheck): string {
  if (check.missing) return "인용 표기가 없습니다 (자료에 근거하지 않았을 수 있음)"
  if (check.invalid.length > 0) return `존재하지 않는 자료를 인용했습니다: ${check.invalid.join(", ")}`
  return ""
}
