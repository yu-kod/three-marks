import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { requestId } from "hono/request-id";

/**
 * すべてのリクエストを1行の構造化ログ（JSON）として出力する。
 *
 * 404 を含む全レスポンスを CloudWatch に残し、Logs Insights で集計しやすくする。
 * リクエスト ID（X-Request-Id。無ければ発行）を付けて、同じリクエストのログを串刺しで追えるようにする。
 *
 * IP アドレスや User-Agent のような個人を追跡できる情報は出さない。
 */
export function requestLogger() {
  return every(
    requestId(),
    createMiddleware(async (c, next) => {
      const start = Date.now();
      await next();

      console.info(
        JSON.stringify({
          level: "info",
          requestId: c.get("requestId"),
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          durationMs: Date.now() - start,
        })
      );
    })
  );
}
