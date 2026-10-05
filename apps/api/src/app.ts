import { createGuestRoutes, createGuestService, identity, type IdentityEnv } from "@app/identity";
import { errorHandler, NotFoundError, requestLogger } from "@app/server-core";
import { Hono } from "hono";
import { createDepsFromEnv, type AppDeps } from "./deps.js";
import { createRoomRoutes } from "./rooms/room-routes.js";
import { createRoomService } from "./rooms/room-service.js";

/**
 * Hono アプリを組み立てる。
 *
 * Lambda（src/lambda.ts）とローカル開発（src/index.ts）の両方から同じアプリを使うため、
 * listen は呼び出し側に任せる。依存は環境変数から組み立て、テストでは直接渡して差し替える。
 */
export function createApp(deps: Partial<AppDeps> = {}) {
  const { guestStore, roomStore } = { ...createDepsFromEnv(), ...deps };
  const guests = createGuestService({ store: guestStore });
  const rooms = createRoomService({ store: roomStore });

  const app = new Hono<IdentityEnv>();

  app.use(requestLogger());
  app.use(identity([guests.authenticate]));
  app.onError(errorHandler);
  app.notFound((c) => {
    throw new NotFoundError(`${c.req.method} ${c.req.path} は存在しない`);
  });

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.route("/api/guests", createGuestRoutes(guests));
  app.route("/api/rooms", createRoomRoutes(rooms));

  return app;
}
