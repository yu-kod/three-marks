import { NotFoundError } from "@app/server-core";
import type { RoomService } from "../rooms/room-service.js";
import type { ConnectionStore } from "./connection-store.js";

/** API Gateway の WebSocket 接続は最長 2 時間で切れる。記録もそこで期限切れにする */
export const CONNECTION_TTL_SECONDS = 2 * 60 * 60;

/** API Gateway WebSocket API から Lambda に届くイベントのうち、使う項目だけ */
export type WebSocketEvent = {
  requestContext: { routeKey: string; connectionId: string };
  /** $connect のときだけ。`wss://...?room=<roomId>` */
  queryStringParameters?: Record<string, string | undefined>;
};

export type WebSocketDeps = {
  connections: ConnectionStore;
  rooms: Pick<RoomService, "getRoom">;
  /** 現在時刻（ミリ秒） */
  now?: () => number;
};

/**
 * WebSocket API の Lambda。接続を「どのルームの更新を受け取るか」と一緒に覚えるだけ。
 *
 * 通知の中身は「更新があった」だけ（notifier.ts）なので、接続にゲストの認証は求めない。
 * 受け取れるのは招待 URL の ID を知っている人だけで、知って得られるのは更新のタイミングだけ。
 */
export function createWebSocketHandler({ connections, rooms, now = Date.now }: WebSocketDeps) {
  return async (event: WebSocketEvent): Promise<{ statusCode: number }> => {
    const { routeKey, connectionId } = event.requestContext;

    if (routeKey === "$connect") {
      const roomId = event.queryStringParameters?.room;
      if (!roomId) {
        return { statusCode: 400 };
      }
      try {
        await rooms.getRoom(roomId);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return { statusCode: 404 };
        }
        throw error;
      }
      const expiresAt = Math.floor(now() / 1000) + CONNECTION_TTL_SECONDS;
      await connections.add({ connectionId, roomId, expiresAt });
    } else if (routeKey === "$disconnect") {
      await connections.remove(connectionId);
    }
    // $default（クライアントから送られたメッセージ）は使わない
    return { statusCode: 200 };
  };
}
