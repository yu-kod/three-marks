import { errorHandler } from "@app/server-core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ANIMALS } from "./guest-name.js";
import { createGuestRoutes, GUEST_NAME_MAX_LENGTH } from "./guest-routes.js";
import { createGuestService } from "./guest-service.js";
import { createInMemoryGuestStore } from "./guest-store.js";
import { identity, type IdentityEnv } from "./middleware.js";

function setup() {
  let seq = 0;
  const service = createGuestService({
    store: createInMemoryGuestStore(),
    generateToken: () => `token-${++seq}`,
    generateId: () => `guest-${seq}`,
  });
  const app = new Hono<IdentityEnv>();
  app.onError(errorHandler);
  app.use(identity([service.authenticate]));
  app.route("/api/guests", createGuestRoutes(service, { generateName: () => "ねむいペンギン" }));

  function request(method: string, path: string, init: { body?: unknown; token?: string } = {}) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    return app.request(path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  }
  return { request };
}

describe("POST /api/guests", () => {
  it("名前を登録してゲストとトークンを返す", async () => {
    const res = await setup().request("POST", "/api/guests", { body: { name: "Alice" } });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      guest: { kind: "guest", id: "guest-1", name: "Alice" },
      token: "token-1",
    });
  });

  it("名前を省略したら仮の名前を付ける（名前の入力で遊び始めるのを止めない）", async () => {
    const res = await setup().request("POST", "/api/guests", { body: {} });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({ guest: { name: "ねむいペンギン" } });
  });

  it("仮の名前の付け方を渡さなければ、形容詞と動物の名前を付ける", async () => {
    const service = createGuestService({ store: createInMemoryGuestStore() });
    const app = new Hono().route("/api/guests", createGuestRoutes(service));

    const res = await app.request("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const { guest } = (await res.json()) as { guest: { name: string } };
    expect(ANIMALS.some((animal) => guest.name.endsWith(animal))).toBe(true);
  });

  it("名前の前後の空白は落とす", async () => {
    const res = await setup().request("POST", "/api/guests", { body: { name: "  Alice  " } });

    await expect(res.json()).resolves.toMatchObject({ guest: { name: "Alice" } });
  });

  it.each([
    ["空", ""],
    ["空白だけ", "   "],
    ["上限を超える", "あ".repeat(GUEST_NAME_MAX_LENGTH + 1)],
  ])("名前が%sなら 400", async (_label, name) => {
    const res = await setup().request("POST", "/api/guests", { body: { name } });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("上限ちょうどの名前は通す", async () => {
    const name = "あ".repeat(GUEST_NAME_MAX_LENGTH);

    const res = await setup().request("POST", "/api/guests", { body: { name } });

    expect(res.status).toBe(201);
  });
});

describe("GET /api/guests/me", () => {
  it("トークンの持ち主を返す", async () => {
    const { request } = setup();
    await request("POST", "/api/guests", { body: { name: "Alice" } });

    const res = await request("GET", "/api/guests/me", { token: "token-1" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      guest: { kind: "guest", id: "guest-1", name: "Alice" },
    });
  });

  it("トークンが無効なら 401", async () => {
    const res = await setup().request("GET", "/api/guests/me", { token: "forged" });

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/guests/me", () => {
  it("名前を変える", async () => {
    const { request } = setup();
    await request("POST", "/api/guests", { body: { name: "Alice" } });

    const res = await request("PATCH", "/api/guests/me", {
      token: "token-1",
      body: { name: "Alicia" },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      guest: { kind: "guest", id: "guest-1", name: "Alicia" },
    });
  });

  it("トークンが無効なら 401", async () => {
    const res = await setup().request("PATCH", "/api/guests/me", {
      token: "forged",
      body: { name: "Mallory" },
    });

    expect(res.status).toBe(401);
  });

  it("名前が不正なら 400", async () => {
    const { request } = setup();
    await request("POST", "/api/guests", { body: { name: "Alice" } });

    const res = await request("PATCH", "/api/guests/me", { token: "token-1", body: { name: "" } });

    expect(res.status).toBe(400);
  });
});
