import { describe, expect, it } from "vitest";
import { createRoomService } from "../rooms/room-service.js";
import { createInMemoryRoomStore } from "../rooms/room-store.js";
import { createInMemoryConnectionStore } from "./connection-store.js";
import { CONNECTION_TTL_SECONDS, createWebSocketHandler } from "./websocket-handler.js";

const alice = { kind: "guest" as const, id: "g-1", name: "Alice" };

async function setup() {
  const connections = createInMemoryConnectionStore();
  const rooms = createRoomService({
    store: createInMemoryRoomStore(),
    generateId: () => "room-1",
    now: () => 1_000_000,
  });
  await rooms.createRoom(alice);
  const handler = createWebSocketHandler({ connections, rooms, now: () => 1_000_000 });
  return { handler, connections };
}

const event = (
  routeKey: string,
  connectionId: string,
  queryStringParameters?: Record<string, string>
) => ({ requestContext: { routeKey, connectionId }, queryStringParameters });

describe("createWebSocketHandler", () => {
  it("$connect で ?room= のルームの更新を受け取る接続として覚える", async () => {
    const { handler, connections } = await setup();

    const res = await handler(event("$connect", "c1", { room: "room-1" }));

    expect(res).toEqual({ statusCode: 200 });
    await expect(connections.listByRoom("room-1")).resolves.toEqual(["c1"]);
  });

  it("接続の記録は API Gateway の接続の上限（2時間）で期限切れにする", async () => {
    const { connections } = await setup();
    const added: unknown[] = [];
    const spying = createWebSocketHandler({
      connections: { ...connections, add: async (c) => void added.push(c) },
      rooms: { getRoom: async () => ({}) as never },
      now: () => 1_000_000,
    });

    await spying(event("$connect", "c1", { room: "room-1" }));

    expect(added).toEqual([
      { connectionId: "c1", roomId: "room-1", expiresAt: 1_000 + CONNECTION_TTL_SECONDS },
    ]);
  });

  it.each([
    ["ルームの指定が無い", undefined, 400],
    ["無いルーム", { room: "nope" }, 404],
  ])("$connect で%sなら接続を断る", async (_, query, status) => {
    const { handler, connections } = await setup();

    const res = await handler(event("$connect", "c1", query));

    expect(res).toEqual({ statusCode: status });
    await expect(connections.listByRoom("nope")).resolves.toEqual([]);
  });

  it("ルームを確かめられなかった（DB の失敗など）ときは投げて、接続を断る（API Gateway が 500 にする）", async () => {
    const failure = new Error("db");
    const handler = createWebSocketHandler({
      connections: createInMemoryConnectionStore(),
      rooms: { getRoom: () => Promise.reject(failure) },
    });

    await expect(handler(event("$connect", "c1", { room: "room-1" }))).rejects.toBe(failure);
  });

  it("$disconnect で接続を忘れる", async () => {
    const { handler, connections } = await setup();
    await handler(event("$connect", "c1", { room: "room-1" }));

    await expect(handler(event("$disconnect", "c1"))).resolves.toEqual({ statusCode: 200 });

    await expect(connections.listByRoom("room-1")).resolves.toEqual([]);
  });

  it("クライアントから送られたメッセージ（$default）は受け取るだけで何もしない", async () => {
    const { handler } = await setup();

    await expect(handler(event("$default", "c1"))).resolves.toEqual({ statusCode: 200 });
  });
});
