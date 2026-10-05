/**
 * API のエラー表現。
 *
 * レスポンスは `{ "error": { "code": "...", "message": "..." } }` で統一する
 * （.claude/skills/coding-standards.md「API 設計」）。変換は errorHandler に集約する。
 */
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    readonly statusCode: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** リクエストの形式が不正（zod の検証に落ちた等） */
export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(400, code, message);
  }
}

/** 資格情報が無い、または無効 */
export class UnauthorizedError extends AppError {
  constructor(message = "認証が必要", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

/** 誰かは分かっているが、その操作は許されていない */
export class ForbiddenError extends AppError {
  constructor(message = "この操作は許可されていない", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "見つからない", code = "NOT_FOUND") {
    super(404, code, message);
  }
}

/**
 * 保存先の状態が読んだときから変わっていて書き込めなかった。
 * クライアントは状態を取り直してからやり直す。
 */
export class ConflictError extends AppError {
  constructor(message = "他の更新と競合した", code = "CONFLICT") {
    super(409, code, message);
  }
}

/** 形式は正しいが、業務ルール（ゲームのルール等）上できない操作 */
export class UnprocessableError extends AppError {
  constructor(message: string, code = "UNPROCESSABLE") {
    super(422, code, message);
  }
}

/** 例外からメッセージを取り出す。Error でないものが投げられても落ちないように */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
