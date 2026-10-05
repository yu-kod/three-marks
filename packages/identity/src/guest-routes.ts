import { parseJson } from "@app/server-core";
import { Hono } from "hono";
import { z } from "zod";
import { generateGuestName } from "./guest-name.js";
import type { GuestService } from "./guest-service.js";
import { bearerToken, requireIdentity, type IdentityEnv } from "./middleware.js";

/** 画面に並べて崩れない長さ。アプリごとに変えたくなったら引数にする */
export const GUEST_NAME_MAX_LENGTH = 20;

const name = z
  .string()
  .trim()
  .min(1, "名前を入力してください")
  .max(GUEST_NAME_MAX_LENGTH, `名前は${GUEST_NAME_MAX_LENGTH}文字以内にしてください`);

const nameSchema = z.object({ name });

/** 登録では名前を省略できる。空文字は省略ではなく入力の誤りとして弾く */
const registerSchema = z.object({ name: name.optional() });

export type GuestRoutesOptions = {
  /** 名前が省略されたときに付ける名前。テストで固定する */
  generateName?: () => string;
};

/**
 * ゲストの登録と、自分の情報の取得・変更。`/api/guests` にマウントする。
 *
 * 登録で名前を省略すると仮の名前（「ねむいペンギン」など）を付ける。最初の画面で
 * 名前の入力を求めず、まず遊び始められるようにするため（docs/template.md「ゲスト」）。
 *
 * 前段に identity([service.authenticate, ...]) を置くこと。
 */
export function createGuestRoutes(
  service: GuestService,
  { generateName = generateGuestName }: GuestRoutesOptions = {}
) {
  const routes = new Hono<IdentityEnv>();

  routes.post("/", async (c) => {
    const { name = generateName() } = await parseJson(c, registerSchema);
    return c.json(await service.register(name), 201);
  });

  routes.get("/me", requireIdentity(), (c) => c.json({ guest: c.var.identity }));

  routes.patch("/me", requireIdentity(), async (c) => {
    const { name } = await parseJson(c, nameSchema);
    // requireIdentity を通っているのでトークンは必ずある
    const token = bearerToken(c.req.header("Authorization"))!;
    return c.json({ guest: await service.rename(token, name) });
  });

  return routes;
}
