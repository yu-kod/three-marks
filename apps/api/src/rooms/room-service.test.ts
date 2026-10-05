import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@app/server-core";
import type { Rng } from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import {
  createRoomService,
  ROOM_TTL_SECONDS,
  type RoomService,
  type RoomServiceDeps,
} from "./room-service.js";
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
      seatDraw: null,
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

describe("席（参加者の並び）", () => {
  it("席は参加した順で、開き直しても（再接続しても）同じ席のまま", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.join("room-1", bob);
    await service.join("room-1", guest("g-3", "Carol"));

    const room = await service.join("room-1", bob);

    expect(room.members.map((m) => m.id)).toEqual(["g-1", "g-2", "g-3"]);
  });
});

describe("leave", () => {
  it("席を離れると参加者から外れ、後ろの人の席が1つずつ詰まる", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.join("room-1", bob);
    await service.join("room-1", guest("g-3", "Carol"));

    const room = await service.leave("room-1", bob);

    expect(room.members.map((m) => m.id)).toEqual(["g-1", "g-3"]);
  });

  it("ホストが離れたら、次に参加した人がホストになる", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.join("room-1", bob);

    await expect(service.leave("room-1", alice)).resolves.toMatchObject({
      hostId: "g-2",
      members: [{ id: "g-2" }],
    });
  });

  it("全員が離れたら、次に参加した人がホストになる", async () => {
    const { service } = setup();
    await service.createRoom(alice);
    await service.leave("room-1", alice);

    await expect(service.join("room-1", bob)).resolves.toMatchObject({
      hostId: "g-2",
      members: [{ id: "g-2" }],
    });
  });

  it("参加していない人が離れても何も変わらない", async () => {
    const { service } = setup();
    const created = await service.createRoom(alice);

    await expect(service.leave("room-1", bob)).resolves.toEqual(created);
  });
});

describe("arrangeSeats", () => {
  async function threePlayers() {
    const ctx = setup();
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.join("room-1", guest("g-3", "Carol"));
    return ctx;
  }

  it("ホストは席の並びを決められる", async () => {
    const { service } = await threePlayers();

    const room = await service.arrangeSeats("room-1", alice, ["g-3", "g-1", "g-2"]);

    expect(room.members.map((m) => m.id)).toEqual(["g-3", "g-1", "g-2"]);
  });

  it("ホスト以外は ForbiddenError（他人の席は動かせない）", async () => {
    const { service } = await threePlayers();

    await expect(service.arrangeSeats("room-1", bob, ["g-3", "g-1", "g-2"])).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it.each([
    ["足りない", ["g-1", "g-2"]],
    ["参加していない人がいる", ["g-1", "g-2", "g-9"]],
    ["同じ人が2回いる", ["g-1", "g-2", "g-2"]],
  ])("並びが今の参加者とちょうど一致しない（%s）なら UnprocessableError", async (_, order) => {
    const { service } = await threePlayers();

    const result = service.arrangeSeats("room-1", alice, order);

    await expect(result).rejects.toBeInstanceOf(UnprocessableError);
    await expect(result).rejects.toMatchObject({ code: "SEATS_MISMATCH" });
  });
});

describe("drawSeats — カードを引いて席順を決める", () => {
  /** 引く位置を指定する乱数（engine の seating.test.ts と同じ山の並び） */
  const picks = (...indices: number[]): Rng => {
    let i = 0;
    return { nextInt: () => indices[i++]! };
  };

  async function threePlayers(seatRng: Rng) {
    const ctx = setup({ createSeatRng: () => seatRng });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.join("room-1", guest("g-3", "Carol"));
    return ctx;
  }

  it("ホストが引くと、強い順に席が並び、誰が何を引いたかが全員に見える", async () => {
    // Alice 15, Bob Bull, Carol 18
    const { service } = await threePlayers(picks(0, 39, 17));

    await service.drawSeats("room-1", alice);
    const room = await service.getRoom("room-1");

    expect(room.members.map((m) => m.id)).toEqual(["g-2", "g-3", "g-1"]);
    expect(room.seatDraw).toEqual([
      [
        { player: "g-1", target: 15 },
        { player: "g-2", target: "bull" },
        { player: "g-3", target: 18 },
      ],
    ]);
  });

  it("引く前のルームには引いた結果が無い", async () => {
    const { service } = setup();

    await expect(service.createRoom(alice)).resolves.toMatchObject({ seatDraw: null });
  });

  it("ホスト以外は ForbiddenError", async () => {
    const { service } = await threePlayers(picks(0, 39, 17));

    await expect(service.drawSeats("room-1", bob)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it.each([
    ["誰かが参加した", (s: RoomService) => s.join("room-1", guest("g-4", "Dave"))],
    ["誰かが離れた", (s: RoomService) => s.leave("room-1", bob)],
    [
      "ホストが並べ直した",
      (s: RoomService) => s.arrangeSeats("room-1", alice, ["g-1", "g-2", "g-3"]),
    ],
  ])("引いたあとで%sら、古い結果は消える（今の席順と合わなくなるため）", async (_, change) => {
    const { service } = await threePlayers(picks(0, 39, 17));
    await service.drawSeats("room-1", alice);

    await change(service);

    await expect(service.getRoom("room-1")).resolves.toMatchObject({ seatDraw: null });
  });

  it("乱数を渡さなければ、毎回違うシードで引く", async () => {
    const { service } = setup({ createSeatRng: undefined });
    await service.createRoom(alice);
    await service.join("room-1", bob);

    const room = await service.drawSeats("room-1", alice);

    expect(room.members.map((m) => m.id).sort()).toEqual(["g-1", "g-2"]);
    expect(room.seatDraw!.length).toBeGreaterThanOrEqual(1);
  });
});
