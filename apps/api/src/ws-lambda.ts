/**
 * Lambda のエントリポイント（API Gateway WebSocket API の $connect / $disconnect / $default）。
 *
 * HTTP API の Lambda（lambda.ts）と同じコード・同じテーブルを使い、ハンドラだけを分ける。
 */
import { createDepsFromEnv } from "./deps.js";
import { createRoomService } from "./rooms/room-service.js";
import { createWebSocketHandler } from "./realtime/websocket-handler.js";

const deps = createDepsFromEnv();

export const handler = createWebSocketHandler({
  connections: deps.connectionStore,
  rooms: createRoomService({ store: deps.roomStore }),
});
