import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorHandler } from "./error-handler.js";
import { parseJson } from "./validation.js";

const schema = z.object({ name: z.string().min(1, "name は必須") });

function app() {
  const app = new Hono();
  app.onError(errorHandler);
  app.post("/echo", async (c) => c.json(await parseJson(c, schema)));
  return app;
}

function post(body: string) {
  return app().request("/echo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("parseJson", () => {
  it("スキーマに合うボディを型付きで返す", async () => {
    const res = await post(JSON.stringify({ name: "Alice", extra: 1 }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: "Alice" });
  });

  it("スキーマに合わなければ最初の問題を 400 で返す", async () => {
    const res = await post(JSON.stringify({ name: "" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: { code: "VALIDATION_ERROR", message: "name は必須" },
    });
  });

  it("JSON として読めなければ 400 を返す", async () => {
    const res = await post("{not json");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: { code: "VALIDATION_ERROR", message: "リクエストボディが JSON ではない" },
    });
  });
});
