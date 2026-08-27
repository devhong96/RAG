import type { Response } from "express"

/** 에러 응답 형식을 한곳에서 통일한다. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  detail?: unknown,
): void {
  res.status(status).json({
    error: { code, message, ...(detail !== undefined ? { detail } : {}) },
  })
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 에러"
}
