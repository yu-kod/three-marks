import type { ErrorHandler } from "hono";
import { AppError, messageOf } from "./errors.js";

/**
 * `app.onError(errorHandler)` で使う。
 *
 * AppError は自身のステータスで返す。それ以外は利用者に中身を見せず 500 にし、
 * 原因を追えるよう構造化ログへ残す。
 */
export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message } }, error.statusCode);
  }

  console.error(
    JSON.stringify({
      level: "error",
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      message: messageOf(error),
      stack: error.stack,
    })
  );
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "サーバーで想定外のエラーが起きた" } },
    500
  );
};
