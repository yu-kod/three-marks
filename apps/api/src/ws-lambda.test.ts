import { describe, expect, it } from "vitest";

describe("WebSocket の Lambda エントリポイント", () => {
  it("handler をエクスポートする", async () => {
    const mod = await import("./ws-lambda.js");

    expect(typeof mod.handler).toBe("function");
  });
});
