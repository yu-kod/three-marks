import { messageOf } from "@app/server-core";
import type { ConnectionStore } from "./connection-store.js";

/** 1本の接続へ送る。もう切れていれば "gone" */
export type Post = (connectionId: string, data: string) => Promise<"sent" | "gone">;

export type RoomNotifier = {
  /** ルームの状態が変わったことを、そのルームの接続へ知らせる。失敗しても投げない */
  roomChanged(roomId: string): Promise<void>;
};

/** 何もしない（ローカル開発や、WebSocket を使わない環境） */
export const silentNotifier: RoomNotifier = { roomChanged: async () => {} };

function logError(message: string, context: Record<string, string>, error: unknown) {
  console.error(JSON.stringify({ level: "error", message, ...context, error: messageOf(error) }));
}

/**
 * ルームの更新を WebSocket で知らせる。
 *
 * 送るのは「更新があった」だけで、状態の中身は送らない。受け取ったクライアントが HTTP で
 * 自分向けの状態を取り直す。こうすると、送り先ごとに見せてよい情報を分ける必要が無い。
 *
 * 通知は補助なので、失敗してもルームの操作は失敗させない（クライアントはポーリングでも追いつく）。
 */
export function createRoomNotifier({
  connections,
  post,
}: {
  connections: ConnectionStore;
  post: Post;
}): RoomNotifier {
  async function send(roomId: string, connectionId: string, data: string) {
    try {
      if ((await post(connectionId, data)) === "gone") {
        await connections.remove(connectionId);
      }
    } catch (error) {
      logError("ルームの更新を送れなかった", { roomId, connectionId }, error);
    }
  }

  return {
    async roomChanged(roomId) {
      try {
        const data = JSON.stringify({ type: "room-changed", roomId });
        const ids = await connections.listByRoom(roomId);
        await Promise.all(ids.map((id) => send(roomId, id, data)));
      } catch (error) {
        logError("ルームの接続を引けなかった", { roomId }, error);
      }
    },
  };
}
