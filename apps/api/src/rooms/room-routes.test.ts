import { beforeEach, describe, expect, it, vi } from "vitest";
import { testClient } from "../test-utils/client.js";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("POST /api/rooms", () => {
  it("ゲストがルームを作ると、自分がホストで最初の参加者のルームが返る", async () => {
    const client = testClient();
    const alice = await client.guest("Alice");

    const res = await client.request("POST", "/api/rooms", { token: alice.token });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      room: {
        id: expect.stringMatching(/^[A-Za-z0-9_-]{12}$/),
        hostId: alice.id,
        members: [{ id: alice.id, name: "Alice" }],
        maxPlayers: 4,
      },
    });
  });

  it("ゲストでなければ 401", async () => {
    const res = await testClient().request("POST", "/api/rooms");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/rooms/:id", () => {
  it("招待 URL の ID でルームを見られる（参加前でも、誰のルームか分かるように）", async () => {
    const client = testClient();
    const alice = await client.guest("Alice");
    const { body } = await client.request("POST", "/api/rooms", { token: alice.token });

    const res = await client.request("GET", `/api/rooms/${body.room.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ room: body.room });
  });

  it("無いルームは統一フォーマットの 404", async () => {
    const res = await testClient().request("GET", "/api/rooms/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "ROOM_NOT_FOUND", message: expect.any(String) },
    });
  });
});

describe("POST /api/rooms/:id/join", () => {
  async function roomWithHost() {
    const client = testClient();
    const alice = await client.guest("Alice");
    const { body } = await client.request("POST", "/api/rooms", { token: alice.token });
    return { client, alice, roomId: body.room.id };
  }

  it("招待 URL を開いたゲストが参加できる", async () => {
    const { client, alice, roomId } = await roomWithHost();
    const bob = await client.guest("Bob");

    const res = await client.request("POST", `/api/rooms/${roomId}/join`, { token: bob.token });

    expect(res.status).toBe(200);
    expect(res.body.room.members).toEqual([
      { id: alice.id, name: "Alice" },
      { id: bob.id, name: "Bob" },
    ]);
  });

  it("満員なら 422（ROOM_FULL）", async () => {
    const { client, roomId } = await roomWithHost();
    for (const name of ["B", "C", "D"]) {
      const { token } = await client.guest(name);
      await client.request("POST", `/api/rooms/${roomId}/join`, { token });
    }
    const late = await client.guest("E");

    const res = await client.request("POST", `/api/rooms/${roomId}/join`, { token: late.token });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ROOM_FULL");
  });

  it("ゲストでなければ 401", async () => {
    const { client, roomId } = await roomWithHost();

    const res = await client.request("POST", `/api/rooms/${roomId}/join`);

    expect(res.status).toBe(401);
  });
});
