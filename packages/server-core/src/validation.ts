import type { Context } from "hono";
import type { z } from "zod";
import { ValidationError } from "./errors.js";

/**
 * リクエストボディを JSON として読み、スキーマで検証する。
 *
 * 失敗したら ValidationError（400）を投げる。メッセージは最初の問題だけを返す。
 */
export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError("リクエストボディが JSON ではない");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // 検証に落ちたとき zod は必ず1件以上の issue を返す
    throw new ValidationError(parsed.error.issues[0]!.message);
  }
  return parsed.data;
}
