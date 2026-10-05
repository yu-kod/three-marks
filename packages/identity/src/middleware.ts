import { UnauthorizedError } from "@app/server-core";
import { createMiddleware } from "hono/factory";
import type { Identity, IdentityResolver } from "./identity.js";

/** `new Hono<IdentityEnv>()` で `c.var.identity` に型が付く */
export type IdentityEnv = {
  Variables: {
    /** 主体が分からなければ null */
    identity: Identity | null;
  };
};

/** `Authorization: Bearer <token>` からトークンを取り出す。無ければ null */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match?.[1] ?? null;
}

/**
 * リクエストの主体を解決して `c.var.identity` に入れる。
 *
 * 解決器を順に試し、最初に主体を返したものを採る（例: ゲスト → Cognito）。
 * 分からなくてもここでは拒否しない。拒否は requireIdentity() が行う。
 */
export function identity(resolvers: IdentityResolver[]) {
  return createMiddleware<IdentityEnv>(async (c, next) => {
    const token = bearerToken(c.req.header("Authorization"));
    let resolved: Identity | null = null;
    if (token !== null) {
      for (const resolve of resolvers) {
        resolved = await resolve(token);
        if (resolved !== null) break;
      }
    }
    c.set("identity", resolved);
    await next();
  });
}

/** 主体が分からなければ 401 にする。identity() の後に置く */
export function requireIdentity() {
  return createMiddleware<IdentityEnv>(async (c, next) => {
    if (!c.var.identity) {
      throw new UnauthorizedError();
    }
    await next();
  });
}
