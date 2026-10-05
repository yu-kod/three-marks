import type { ApiClient } from "@app/web-core";
import type { GameView } from "@three-marks/engine";
import type { TableApi } from "@/game/state/table-store";
import type { RoomView } from "@/game/state/types";

const roomPath = (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}`;

/** テーブルのストアが使う API。ゲストのトークンは client が付ける */
export function createTableApi(client: ApiClient): TableApi {
  return {
    getRoom: async (roomId) => (await client.request<{ room: RoomView }>(roomPath(roomId))).room,
    getGame: async (roomId) =>
      (await client.request<{ game: GameView }>(`${roomPath(roomId)}/game`)).game,
  };
}
