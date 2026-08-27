import { Router } from "express"
import { client } from "../../lib/chroma.js"
import { config } from "../../config.js"

export const healthRouter = Router()

/** Chroma 와 Ollama 가 모두 살아있는지 확인한다. */
healthRouter.get("/health", async (_req, res) => {
  const checks: Record<string, "ok" | "fail"> = {}

  try {
    await client.heartbeat()
    checks.chromadb = "ok"
  } catch {
    checks.chromadb = "fail"
  }

  try {
    const r = await fetch(`${config.ollama.url}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    })
    checks.ollama = r.ok ? "ok" : "fail"
  } catch {
    checks.ollama = "fail"
  }

  const allOk = Object.values(checks).every((v) => v === "ok")
  res.status(allOk ? 200 : 503).json({ status: allOk ? "ok" : "degraded", checks })
})
