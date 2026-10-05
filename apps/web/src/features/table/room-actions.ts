import type { Guest } from "@app/identity-client";
import { ApiRequestError, type ApiClient } from "@app/web-core";
import type { RoomView } from "@/game/state/types";

/** 操作の結果。失敗したら画面にそのまま出せる言葉を返す（Phaser 側は分岐せずに出すだけ） */
export type ActionResult = { ok: true } | { ok: false; message: string };

type Deps = {
  client: ApiClient;
  /** まだゲストでなければ登録する（名前は仮の名前で始める） */
  ensureGuest: () => Promise<Guest>;
};

const messageOf = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : "うまくいきませんでした。もう一度試してください";

const roomPath = (roomId: string) => `/api/rooms/${encodeURIComponent(roomId)}`;

/** 入口の「ルームを作る」 */
export async function createRoom({
  client,
  ensureGuest,
}: Deps): Promise<{ ok: true; roomId: string } | { ok: false; message: string }> {
  try {
    await ensureGuest();
    const { room } = await client.request<{ room: RoomView }>("/api/rooms", { method: "POST" });
    return { ok: true, roomId: room.id };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/** 待合室の操作。成功したらすぐ取り直す（refresh） */
export function createRoomActions({
  client,
  ensureGuest,
  roomId,
  refresh,
}: Deps & { roomId: string; refresh: () => void }) {
  const post = (action: string) => async (): Promise<ActionResult> => {
    try {
      await ensureGuest();
      await client.request(`${roomPath(roomId)}/${action}`, { method: "POST" });
      refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
  };
  return { join: post("join"), leave: post("leave") };
}

export type RoomActions = ReturnType<typeof createRoomActions>;
