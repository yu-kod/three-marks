import { requireIdentity, type IdentityEnv } from "@app/identity";
import { parseJson } from "@app/server-core";
import { Hono } from "hono";
import { z } from "zod";
import type { RoomService } from "./room-service.js";

const seatsSchema = z.object({ order: z.array(z.string()) });

const throwSchema = z.object({ aims: z.array(z.number().int()) });

/** 1枚ずつ（count）か、残りを全部（all） */
const flipSchema = z.union([
  z.object({ count: z.number().int().min(1) }),
  z.object({ all: z.literal(true) }),
]);

/**
 * ルームの作成・参加・取得と、席の操作（離れる・並べる・引いて決める）。`/api/rooms` にマウントする。
 *
 * 前段に identity(...) を置くこと。
 */
export function createRoomRoutes(service: RoomService) {
  const routes = new Hono<IdentityEnv>();

  routes.post("/", requireIdentity(), async (c) => {
    // requireIdentity を通っているので identity は必ずある
    return c.json({ room: await service.createRoom(c.var.identity!) }, 201);
  });

  // 招待 URL を開いた人に、誰のルームかを参加前に見せる。ID を知っている人だけが見られる
  routes.get("/:id", async (c) => c.json({ room: await service.getRoom(c.req.param("id")) }));

  routes.post("/:id/join", requireIdentity(), async (c) =>
    c.json({ room: await service.join(c.req.param("id"), c.var.identity!) })
  );

  routes.post("/:id/leave", requireIdentity(), async (c) =>
    c.json({ room: await service.leave(c.req.param("id"), c.var.identity!) })
  );

  routes.put("/:id/seats", requireIdentity(), async (c) => {
    const { order } = await parseJson(c, seatsSchema);
    return c.json({ room: await service.arrangeSeats(c.req.param("id"), c.var.identity!, order) });
  });

  routes.post("/:id/seats/draw", requireIdentity(), async (c) =>
    c.json({ room: await service.drawSeats(c.req.param("id"), c.var.identity!) })
  );

  // ゲームを始める。始めた人（ホスト）向けの状態も返して、すぐ描けるようにする
  routes.post("/:id/game", requireIdentity(), async (c) => {
    const roomId = c.req.param("id");
    const room = await service.startGame(roomId, c.var.identity!);
    return c.json({ room, game: await service.getGame(roomId, c.var.identity) }, 201);
  });

  // 見る人に見せてよい状態だけを返す。ゲストでなければ観戦者として見る
  routes.get("/:id/game", async (c) =>
    c.json({ game: await service.getGame(c.req.param("id"), c.var.identity) })
  );

  // 狙いを出す（まだめくらない）
  routes.post("/:id/game/throws", requireIdentity(), async (c) => {
    const { aims } = await parseJson(c, throwSchema);
    return c.json({ game: await service.declareAims(c.req.param("id"), c.var.identity!, aims) });
  });

  // 狙いを出した人がめくる。{ count: 1 } で1枚、{ all: true } で残りを全部
  routes.post("/:id/game/flips", requireIdentity(), async (c) => {
    const body = await parseJson(c, flipSchema);
    const count = "all" in body ? "all" : body.count;
    return c.json({ game: await service.flip(c.req.param("id"), c.var.identity!, count) });
  });

  return routes;
}
