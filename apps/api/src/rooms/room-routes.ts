import { requireIdentity, type IdentityEnv } from "@app/identity";
import { Hono } from "hono";
import type { RoomService } from "./room-service.js";

/**
 * ルームの作成・参加・取得。`/api/rooms` にマウントする。
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

  return routes;
}
