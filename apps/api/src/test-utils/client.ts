import { createInMemoryGuestStore, type GuestIdentity } from "@app/identity";
import { createApp } from "../app.js";
import type { AppDeps } from "../deps.js";
import type { GameView } from "@three-marks/engine";
import type { RoomView } from "../rooms/room-service.js";
import { createInMemoryRoomStore } from "../rooms/room-store.js";

/**
 * API が返しうる項目をまとめた型。応答ごとにどれが入るかはテストで確かめるので、
 * ここではすべてあるものとして扱い、テストを型の絞り込みで読みにくくしない。
 */
type ResponseBody = {
  guest: GuestIdentity;
  token: string;
  room: RoomView;
  game: GameView;
  error: { code: string; message: string };
};

/**
 * インメモリの依存で組んだアプリと、それを叩くための小さなクライアント。
 * ルートのテストで、ゲストの登録からまとめて行えるようにする。
 */
export function testClient(deps: Partial<AppDeps> = {}) {
  const app = createApp({
    guestStore: createInMemoryGuestStore(),
    roomStore: createInMemoryRoomStore(),
    ...deps,
  });

  async function request(
    method: string,
    path: string,
    init: { body?: unknown; token?: string } = {}
  ) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    const res = await app.request(path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: (await res.json()) as ResponseBody };
  }

  /** ゲストを登録してトークンを返す */
  async function guest(name: string): Promise<{ id: string; token: string }> {
    const { body } = await request("POST", "/api/guests", { body: { name } });
    return { id: body.guest.id, token: body.token };
  }

  return { request, guest };
}
