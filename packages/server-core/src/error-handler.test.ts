import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler.js";
import { NotFoundError } from "./errors.js";

function appThrowing(error: unknown) {
  const app = new Hono();
  app.use(requestId({ generator: () => "req-1" }));
  app.onError(errorHandler);
  app.get("/boom", () => {
    throw error;
  });
  return app;
}

describe("errorHandler", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("AppError は自身のステータスとコードで返し、ログには出さない", async () => {
    const res = await appThrowing(new NotFoundError("ルームが見つからない")).request("/boom");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "ルームが見つからない" },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("想定外のエラーは中身を隠して 500 を返し、構造化ログに残す", async () => {
    const res = await appThrowing(new Error("kaboom")).request("/boom");

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: { code: "INTERNAL_ERROR", message: "サーバーで想定外のエラーが起きた" },
    });
    const logged = JSON.parse(vi.mocked(console.error).mock.calls[0]?.[0] as string);
    expect(logged).toMatchObject({
      level: "error",
      requestId: "req-1",
      method: "GET",
      path: "/boom",
      message: "kaboom",
    });
  });
});
