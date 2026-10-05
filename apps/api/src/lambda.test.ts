import { describe, expect, it } from "vitest";

describe("Lambda エントリポイント", () => {
  it("handler をエクスポートする", async () => {
    const mod = await import("./lambda.js");

    expect(typeof mod.handler).toBe("function");
  });
});
