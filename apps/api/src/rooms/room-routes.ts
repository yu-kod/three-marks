import { requireIdentity, type IdentityEnv } from "@app/identity";
import { parseJson } from "@app/server-core";
import { Hono } from "hono";
import { z } from "zod";
import type { RoomService } from "./room-service.js";

const seatsSchema = z.object({ order: z.array(z.string()) });

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

  return routes;
}
