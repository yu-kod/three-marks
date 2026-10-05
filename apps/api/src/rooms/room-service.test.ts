import { ConflictError, NotFoundError, UnprocessableError } from "@app/server-core";
import { describe, expect, it } from "vitest";
import { createRoomService, ROOM_TTL_SECONDS, type RoomServiceDeps } from "./room-service.js";
import { createInMemoryRoomStore } from "./room-store.js";

const guest = (id: string, name: string) => ({ kind: "guest" as const, id, name });
const alice = guest("g-1", "Alice");
const bob = guest("g-2", "Bob");

function setup(overrides: Partial<RoomServiceDeps> = {}) {
  let clock = 1_000_000;
  const store = createInMemoryRoomStore();
  const service = createRoomService({
    store,
    now: () => clock,
    generateId: () => "room-1",
    ...overrides,
  });
  return { service, store, advance: (ms: number) => (clock += ms) };
}

describe("createRoom", () => {
  it("作った人がホストで、最初の参加者になる", async () => {
    const { service } = setup();

    await expect(service.createRoom(alice)).resolves.toEqual({
      id: "room-1",
      hostId: "g-1",
      members: [{ id: "g-1", name: "Alice" }],
      maxPlayers: 4,
    });
  });

  it("ルームは作ってから一定時間で期限切れになる", async () => {
    const { service, store } = setup();

    await service.createRoom(alice);

    await expect(store.find("room-1")).resolves.toMatchObject({
      createdAt: 1_000,
      expiresAt: 1_000 + ROOM_TTL_SECONDS,
    });
  });

  it("ID を渡さなければ、推測できない長さの URL に使える ID を作る", async () => {
    const { service } = setup({ generateId: undefined });

    const a = await service.createRoom(alice);
    const b = await service.createRoom(alice);

    expect(a.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(a.id).not.toBe(b.id);
  });
});

describe("getRoom", () => {
  it("作ったルームを ID で見られる", async () => {
    const { service } = setup();
    const created = await service.createRoom(alice);

    await expect(service.getRoom("room-1")).resolves.toEqual(created);
  });

  it("無いルームは NotFoundError", async () => {
    await expect(setup().service.getRoom("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("期限の1秒前までは見られ、期限ちょうどからは NotFoundError（DynamoDB の TTL は消すのが遅れる）", async () => {
    const { service, advance } = setup();
    await service.createRoom(alice);

    advance((ROOM_TTL_SECONDS - 1) * 1000);
    await expect(service.getRoom("room-1")).resolves.toMatchObject({ id: "room-1" });

    advance(1000);
    await expect(service.getRoom("room-1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("join", () => {
  it("参加すると参加者の最後に加わる", async () => {
    const { service } = setup();
    await service.createRoom(alice);

    await expect(service.join("room-1", bob)).resolves.toMatchObject({
      members: [
        { id: "g-1", name: "Alice" },
        { id: "g-2", name: "Bob" },
      ],
    });
  });

  it("参加済みの人がもう一度参加しても増えない（招待 URL を開き直しても大丈夫）", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.join("room-1", bob);

    const room = await service.join("room-1", bob);

    expect(room.members).toHaveLength(2);
  });

  it("上限（4人）ちょうどまでは参加でき、5人目は UnprocessableError", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.join("room-1", guest("g-2", "B"));
    await service.join("room-1", guest("g-3", "C"));
    await expect(service.join("room-1", guest("g-4", "D"))).resolves.toMatchObject({
      members: { length: 4 },
    });

    const fifth = service.join("room-1", guest("g-5", "E"));

    await expect(fifth).rejects.toBeInstanceOf(UnprocessableError);
    await expect(fifth).rejects.toMatchObject({ code: "ROOM_FULL" });
  });

  it("満員でも、参加済みの人が開き直すのは弾かない", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    for (const id of ["g-2", "g-3", "g-4"]) await service.join("room-1", guest(id, id));

    await expect(service.join("room-1", alice)).resolves.toMatchObject({ members: { length: 4 } });
  });

  it("期限切れや無いルームには参加できない", async () => {
    const { service, advance } = setup();
    await service.createRoom(alice);
    advance(ROOM_TTL_SECONDS * 1000);

    await expect(service.join("room-1", bob)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.join("nope", bob)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("join — 同時に参加したとき", () => {
  it("同時に参加しても、両方とも参加者に入る（後から書いた方が読み直してやり直す）", async () => {
    const { service } = setup();
    await service.createRoom(alice);

    await Promise.all([service.join("room-1", bob), service.join("room-1", guest("g-3", "Carol"))]);

    const room = await service.getRoom("room-1");
    expect(room.members.map((m) => m.id).sort()).toEqual(["g-1", "g-2", "g-3"]);
  });

  it("何度やり直しても書けなければ ConflictError（無限に回らない）", async () => {
    const store = createInMemoryRoomStore();
    const { service } = setup({
      store: {
        ...store,
        save: async () => {
          throw new ConflictError();
        },
      },
    });
    await service.createRoom(alice);

    await expect(service.join("room-1", bob)).rejects.toBeInstanceOf(ConflictError);
  });
});
