import { errorHandler } from "@app/server-core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Identity, IdentityResolver } from "./identity.js";
import { bearerToken, identity, requireIdentity, type IdentityEnv } from "./middleware.js";

const alice: Identity = { kind: "guest", id: "g-1", name: "Alice" };

const resolveAlice: IdentityResolver = async (token) => (token === "alice-token" ? alice : null);
const resolveNobody: IdentityResolver = async () => null;

function app(resolvers: IdentityResolver[]) {
  const app = new Hono<IdentityEnv>();
  app.onError(errorHandler);
  app.use(identity(resolvers));
  app.get("/whoami", (c) => c.json({ identity: c.var.identity }));
  app.get("/private", requireIdentity(), (c) => c.json({ name: c.var.identity?.name }));
  return app;
}

function get(path: string, authorization?: string) {
  return app([resolveNobody, resolveAlice]).request(
    path,
    authorization ? { headers: { Authorization: authorization } } : {}
  );
}

describe("identity", () => {
  it("Bearer トークンを順に解決し、最初に分かった主体を入れる", async () => {
    const res = await get("/whoami", "Bearer alice-token");

    await expect(res.json()).resolves.toEqual({ identity: alice });
  });

  it("トークンが無ければ主体は null（公開ページはそのまま通す）", async () => {
    const res = await get("/whoami");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ identity: null });
  });

  it("どの解決器も知らないトークンなら null", async () => {
    const res = await get("/whoami", "Bearer forged");

    await expect(res.json()).resolves.toEqual({ identity: null });
  });

  it("Bearer 以外の形式は無視する", async () => {
    const res = await get("/whoami", "Basic YWxpY2U6cGFzcw==");

    await expect(res.json()).resolves.toEqual({ identity: null });
  });
});

describe("requireIdentity", () => {
  it("主体が分かれば通す", async () => {
    const res = await get("/private", "Bearer alice-token");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: "Alice" });
  });

  it("主体が分からなければ 401", async () => {
    const res = await get("/private", "Bearer forged");

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});

describe("bearerToken", () => {
  it.each([
    ["Bearer abc", "abc"],
    ["bearer abc", "abc"],
    ["Bearer   abc  ", "abc"],
    ["Bearer ", null],
    ["Basic abc", null],
    [undefined, null],
  ])("%s → %s", (header, expected) => {
    expect(bearerToken(header)).toBe(expected);
  });
});
