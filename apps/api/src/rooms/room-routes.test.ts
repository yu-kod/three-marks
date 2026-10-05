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
        members: [{ id: alice.id, name: "Alice", cpu: false }],
        maxPlayers: 4,
        seatDraw: null,
        status: "waiting",
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
      { id: alice.id, name: "Alice", cpu: false },
      { id: bob.id, name: "Bob", cpu: false },
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

describe("席の操作", () => {
  async function twoPlayers() {
    const client = testClient();
    const alice = await client.guest("Alice");
    const bob = await client.guest("Bob");
    const { body } = await client.request("POST", "/api/rooms", { token: alice.token });
    const roomId = body.room.id;
    await client.request("POST", `/api/rooms/${roomId}/join`, { token: bob.token });
    return { client, alice, bob, roomId };
  }

  it("POST /:id/leave で席を離れられる", async () => {
    const { client, bob, roomId } = await twoPlayers();

    const res = await client.request("POST", `/api/rooms/${roomId}/leave`, { token: bob.token });

    expect(res.status).toBe(200);
    expect(res.body.room.members).toHaveLength(1);
  });

  it("PUT /:id/seats でホストが並びを決められる", async () => {
    const { client, alice, bob, roomId } = await twoPlayers();

    const res = await client.request("PUT", `/api/rooms/${roomId}/seats`, {
      token: alice.token,
      body: { order: [bob.id, alice.id] },
    });

    expect(res.status).toBe(200);
    expect(res.body.room.members.map((m: { id: string }) => m.id)).toEqual([bob.id, alice.id]);
  });

  it("PUT /:id/seats はホスト以外なら 403、形がおかしければ 400", async () => {
    const { client, alice, bob, roomId } = await twoPlayers();

    const notHost = await client.request("PUT", `/api/rooms/${roomId}/seats`, {
      token: bob.token,
      body: { order: [bob.id, alice.id] },
    });
    const malformed = await client.request("PUT", `/api/rooms/${roomId}/seats`, {
      token: alice.token,
      body: { order: "nope" },
    });

    expect(notHost.status).toBe(403);
    expect(malformed.status).toBe(400);
  });

  it("POST /:id/seats/draw でホストがカードを引いて席順を決め、結果が返る", async () => {
    const { client, alice, roomId } = await twoPlayers();

    const res = await client.request("POST", `/api/rooms/${roomId}/seats/draw`, {
      token: alice.token,
    });

    expect(res.status).toBe(200);
    expect(res.body.room.seatDraw?.[0]).toHaveLength(2);
  });

  it.each([
    ["POST", "leave"],
    ["PUT", "seats"],
    ["POST", "seats/draw"],
  ])("%s /:id/%s はゲストでなければ 401", async (method, path) => {
    const { client, roomId } = await twoPlayers();

    const res = await client.request(method, `/api/rooms/${roomId}/${path}`, { body: {} });

    expect(res.status).toBe(401);
  });
});

describe("ゲーム", () => {
  async function twoPlayers() {
    const client = testClient();
    const alice = await client.guest("Alice");
    const bob = await client.guest("Bob");
    const { body } = await client.request("POST", "/api/rooms", { token: alice.token });
    const roomId = body.room.id;
    await client.request("POST", `/api/rooms/${roomId}/join`, { token: bob.token });
    return { client, alice, bob, roomId };
  }

  it("POST /:id/game でホストが始めると、ルームが playing になり、自分向けのゲームが返る", async () => {
    const { client, alice, roomId } = await twoPlayers();

    const res = await client.request("POST", `/api/rooms/${roomId}/game`, { token: alice.token });

    expect(res.status).toBe(201);
    expect(res.body.room.status).toBe("playing");
    expect(res.body.game.myHand).toHaveLength(5);
    expect(res.body.game.currentThrower).toBe(alice.id);
  });

  it("GET /:id/game で自分向けの状態を取れる。ゲストでなければ観戦者として見る", async () => {
    const { client, alice, bob, roomId } = await twoPlayers();
    await client.request("POST", `/api/rooms/${roomId}/game`, { token: alice.token });

    const mine = await client.request("GET", `/api/rooms/${roomId}/game`, { token: bob.token });
    const spectator = await client.request("GET", `/api/rooms/${roomId}/game`);

    expect(mine.status).toBe(200);
    expect(mine.body.game.myHand).toHaveLength(5);
    expect(spectator.body.game.myHand).toBeNull();
    // 山札の中身と全員の手札（サーバーの GameState の項目）は返さない
    expect(spectator.body.game).not.toHaveProperty("deck");
    expect(spectator.body.game).not.toHaveProperty("hands");
  });

  it("POST /:id/game/throws で手番の人が狙いを出す", async () => {
    const { client, alice, roomId } = await twoPlayers();
    const started = await client.request("POST", `/api/rooms/${roomId}/game`, {
      token: alice.token,
    });
    const aims = started.body.game.myHand!.slice(0, 3).map((c) => c.id);

    const res = await client.request("POST", `/api/rooms/${roomId}/game/throws`, {
      token: alice.token,
      body: { aims },
    });

    expect(res.status).toBe(200);
    expect(res.body.game.pending?.aims).toHaveLength(3);
    expect(res.body.game.throws).toHaveLength(0);
  });

  it("POST /:id/game/flips で1枚ずつ、または残りを全部めくる", async () => {
    const { client, alice, roomId } = await twoPlayers();
    const started = await client.request("POST", `/api/rooms/${roomId}/game`, {
      token: alice.token,
    });
    const aims = started.body.game.myHand!.slice(0, 3).map((c) => c.id);
    await client.request("POST", `/api/rooms/${roomId}/game/throws`, {
      token: alice.token,
      body: { aims },
    });

    const one = await client.request("POST", `/api/rooms/${roomId}/game/flips`, {
      token: alice.token,
      body: { count: 1 },
    });
    const rest = await client.request("POST", `/api/rooms/${roomId}/game/flips`, {
      token: alice.token,
      body: { all: true },
    });

    expect(one.status).toBe(200);
    expect(one.body.game.pending?.flips).toHaveLength(1);
    expect(rest.body.game.pending).toBeNull();
    expect(rest.body.game.throws).toHaveLength(1);
  });

  it("POST /:id/game/flips の形がおかしければ 400", async () => {
    const { client, alice, roomId } = await twoPlayers();

    const zero = await client.request("POST", `/api/rooms/${roomId}/game/flips`, {
      token: alice.token,
      body: { count: 0 },
    });

    expect(zero.status).toBe(400);
  });

  it("手番でない人の投げは 422（GAME_RULE）、形がおかしければ 400", async () => {
    const { client, alice, bob, roomId } = await twoPlayers();
    await client.request("POST", `/api/rooms/${roomId}/game`, { token: alice.token });
    const bobs = await client.request("GET", `/api/rooms/${roomId}/game`, { token: bob.token });

    const notYourTurn = await client.request("POST", `/api/rooms/${roomId}/game/throws`, {
      token: bob.token,
      body: { aims: bobs.body.game.myHand!.slice(0, 3).map((c) => c.id) },
    });
    const malformed = await client.request("POST", `/api/rooms/${roomId}/game/throws`, {
      token: alice.token,
      body: { aims: ["x"] },
    });

    expect(notYourTurn.status).toBe(422);
    expect(notYourTurn.body.error.code).toBe("GAME_RULE");
    expect(malformed.status).toBe(400);
  });

  it.each([
    ["POST", "game"],
    ["POST", "game/throws"],
    ["POST", "game/flips"],
  ])("%s /:id/%s はゲストでなければ 401", async (method, path) => {
    const { client, roomId } = await twoPlayers();

    const res = await client.request(method, `/api/rooms/${roomId}/${path}`, { body: {} });

    expect(res.status).toBe(401);
  });
});
