import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestLogger } from "./request-logger.js";

describe("requestLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("1リクエストにつき1行の JSON を出し、リクエスト ID を付ける", async () => {
    const app = new Hono();
    app.use(requestLogger());
    app.get("/hello", (c) => c.text("hi"));

    const res = await app.request("/hello", { headers: { "X-Request-Id": "abc" } });

    expect(vi.mocked(console.info)).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(vi.mocked(console.info).mock.calls[0]?.[0] as string);
    expect(logged).toMatchObject({
      level: "info",
      requestId: "abc",
      method: "GET",
      path: "/hello",
      status: 200,
    });
    expect(logged.durationMs).toEqual(expect.any(Number));
    // クライアントが問い合わせに使えるよう、レスポンスにも ID を返す
    expect(res.headers.get("X-Request-Id")).toBe("abc");
  });

  it("リクエスト ID が無ければ発行する", async () => {
    const app = new Hono();
    app.use(requestLogger());
    app.get("/hello", (c) => c.text("hi"));

    const res = await app.request("/hello");

    const issued = res.headers.get("X-Request-Id");
    expect(issued).toEqual(expect.any(String));
    const logged = JSON.parse(vi.mocked(console.info).mock.calls[0]?.[0] as string);
    expect(logged.requestId).toBe(issued);
  });

  it("404 もログに残す", async () => {
    const app = new Hono();
    app.use(requestLogger());

    await app.request("/missing");

    const logged = JSON.parse(vi.mocked(console.info).mock.calls[0]?.[0] as string);
    expect(logged).toMatchObject({ path: "/missing", status: 404 });
  });
});
