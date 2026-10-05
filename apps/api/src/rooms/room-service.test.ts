import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@app/server-core";
import { createRng as seeded, type Rng } from "@three-marks/engine";
import { describe, expect, it, vi } from "vitest";
import {
  createRoomService,
  ROOM_TTL_SECONDS,
  type RoomService,
  type RoomServiceDeps,
} from "./room-service.js";
import { createInMemoryRoomStore } from "./room-store.js";

const guest = (id: string, name: string) => ({ kind: "guest" as const, id, name });
const alice = guest("g-1", "Alice");

/** 狙いを出して、残りを一気にめくる */
async function throwAll(service: RoomService, who: { id: string }, aims: number[]) {
  await service.declareAims("room-1", who as typeof alice, aims);
  return service.flip("room-1", who as typeof alice, "all");
}
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
      members: [{ id: "g-1", name: "Alice", cpu: false }],
      maxPlayers: 4,
      seatDraw: null,
      status: "waiting",
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
        { id: "g-1", name: "Alice", cpu: false },
        { id: "g-2", name: "Bob", cpu: false },
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
    const ctx = setup({ createRng: () => seatRng });
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
    const { service } = setup({ createRng: undefined });
    await service.createRoom(alice);
    await service.join("room-1", bob);

    const room = await service.drawSeats("room-1", alice);

    expect(room.members.map((m) => m.id).sort()).toEqual(["g-1", "g-2"]);
    expect(room.seatDraw!.length).toBeGreaterThanOrEqual(1);
  });
});

describe("startGame", () => {
  async function twoPlayers(overrides: Partial<RoomServiceDeps> = {}) {
    const ctx = setup({ createRng: () => seeded(1), ...overrides });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    return ctx;
  }

  it("ホストが始めると、席順のままゲームが始まり、1番目の席から投げる（解釈メモ11）", async () => {
    const { service } = await twoPlayers();
    await service.arrangeSeats("room-1", alice, ["g-2", "g-1"]);

    const room = await service.startGame("room-1", alice);

    expect(room.status).toBe("playing");
    const game = await service.getGame("room-1", alice);
    expect(game.players.map((p) => p.id)).toEqual(["g-2", "g-1", "cpu-1", "cpu-2"]);
    expect(game.currentThrower).toBe("g-2");
  });

  it("4人に足りない席は CPU が埋め、席順は人の後ろ。参加者一覧で CPU だと分かる（解釈メモ13）", async () => {
    const { service } = await twoPlayers();

    const room = await service.startGame("room-1", alice);

    expect(room.members).toEqual([
      { id: "g-1", name: "Alice", cpu: false },
      { id: "g-2", name: "Bob", cpu: false },
      { id: "cpu-1", name: "CPU 1", cpu: true },
      { id: "cpu-2", name: "CPU 2", cpu: true },
    ]);
  });

  it("ゲームを始める前のルームは waiting", async () => {
    const { service } = setup();

    await expect(service.createRoom(alice)).resolves.toMatchObject({ status: "waiting" });
  });

  it("ホスト以外は始められない", async () => {
    const { service } = await twoPlayers();

    await expect(service.startGame("room-1", bob)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("1人でも始められる（残りの3席は CPU）", async () => {
    const { service } = setup({ createRng: () => seeded(1) });
    await service.createRoom(alice);

    const room = await service.startGame("room-1", alice);

    expect(room.members.filter((m) => m.cpu)).toHaveLength(3);
  });

  it("始まったゲームはもう一度始められない", async () => {
    const { service } = await twoPlayers();
    await service.startGame("room-1", alice);

    await expect(service.startGame("room-1", alice)).rejects.toMatchObject({
      code: "GAME_STARTED",
    });
  });

  it("ルームの情報に、ゲームの中身（山札・手札）は含まれない", async () => {
    const { service } = await twoPlayers();

    const room = await service.startGame("room-1", alice);

    expect(Object.keys(room).sort()).toEqual(
      ["hostId", "id", "maxPlayers", "members", "seatDraw", "status"].sort()
    );
  });
});

describe("getGame", () => {
  async function started() {
    const ctx = setup({ createRng: () => seeded(1) });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.startGame("room-1", alice);
    return ctx;
  }

  it("参加者には自分の手札が見え、他人の手札と山札の中身は見えない", async () => {
    const { service, store } = await started();
    const full = (await store.find("room-1"))!.game!;

    const view = await service.getGame("room-1", alice);

    expect(view.myHand).toEqual(full.hands["g-1"]);
    const json = JSON.stringify(view);
    for (const card of [...full.deck, ...full.hands["g-2"]!]) {
      expect(json).not.toContain(`"id":${card.id},`);
    }
  });

  it("参加していない人とゲストでない人は観戦者として見る（手札なし）", async () => {
    const { service } = await started();

    await expect(service.getGame("room-1", guest("g-9", "Eve"))).resolves.toMatchObject({
      myHand: null,
    });
    await expect(service.getGame("room-1", null)).resolves.toMatchObject({ myHand: null });
  });

  it("始まる前は NotFoundError（GAME_NOT_STARTED）", async () => {
    const { service } = setup();
    await service.createRoom(alice);

    await expect(service.getGame("room-1", alice)).rejects.toMatchObject({
      code: "GAME_NOT_STARTED",
    });
  });
});

describe("ゲームが始まったあとのルーム", () => {
  async function started() {
    const ctx = setup({ createRng: () => seeded(1) });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.startGame("room-1", alice);
    return ctx;
  }

  it.each([
    ["新しく参加する", (s: RoomService) => s.join("room-1", guest("g-3", "Carol"))],
    ["席を離れる", (s: RoomService) => s.leave("room-1", bob)],
    ["並べ直す", (s: RoomService) => s.arrangeSeats("room-1", alice, ["g-2", "g-1"])],
    ["カードを引いて決め直す", (s: RoomService) => s.drawSeats("room-1", alice)],
  ])("%sことはできない（GAME_STARTED）", async (_, change) => {
    const { service } = await started();

    await expect(change(service)).rejects.toMatchObject({ code: "GAME_STARTED" });
  });

  it("参加済みの人が招待 URL を開き直す（再接続する）のはできる", async () => {
    const { service } = await started();

    await expect(service.join("room-1", bob)).resolves.toMatchObject({ status: "playing" });
  });
});

describe("投げる（狙いを出して全部めくる）", () => {
  async function started() {
    const ctx = setup({ createRng: () => seeded(1) });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.startGame("room-1", alice);
    return ctx;
  }

  /** 手札の最初の3枚を狙いに出す */
  const firstThree = async (service: RoomService, who: typeof alice) =>
    (await service.getGame("room-1", who)).myHand!.slice(0, 3).map((c) => c.id);

  it("手番の人が手札から3枚出すと、投げた結果が記録され、次の人の手番になる", async () => {
    const { service } = await started();

    const view = await throwAll(service, alice, await firstThree(service, alice));

    expect(view.throws).toHaveLength(1);
    expect(view.throws[0]!.player).toBe("g-1");
    expect(view.currentThrower).toBe("g-2");
    expect(view.myHand).toHaveLength(2);
  });

  it("ルール上できない投げ（手番でない等）は UnprocessableError（GAME_RULE）で、状態は変わらない", async () => {
    const { service } = await started();

    const result = service.declareAims("room-1", bob, await firstThree(service, bob));

    await expect(result).rejects.toBeInstanceOf(UnprocessableError);
    await expect(result).rejects.toMatchObject({ code: "GAME_RULE" });
    await expect(service.getGame("room-1", alice)).resolves.toMatchObject({ throws: [] });
  });

  it("始まる前は投げられない（GAME_NOT_STARTED）", async () => {
    const { service } = setup();
    await service.createRoom(alice);

    await expect(service.declareAims("room-1", alice, [1, 2, 3])).rejects.toMatchObject({
      code: "GAME_NOT_STARTED",
    });
  });

  it("投げ続けて誰かが上がったら、ルームは finished になり勝者が見える", async () => {
    const { service } = await started();
    const players = { "g-1": alice, "g-2": bob };

    for (let i = 0; i < 500; i++) {
      const view = await service.getGame("room-1", alice);
      if (view.phase === "finished") break;
      const who = players[view.currentThrower as keyof typeof players];
      await throwAll(service, who, await firstThree(service, who));
    }

    await expect(service.getRoom("room-1")).resolves.toMatchObject({ status: "finished" });
    const view = await service.getGame("room-1", alice);
    expect(view.winners!.length).toBeGreaterThan(0);
  });
});

describe("ルームの更新の通知", () => {
  function withNotifier() {
    const roomChanged = vi.fn(async (_roomId: string) => {});
    return { roomChanged, ...setup({ notifier: { roomChanged }, createRng: () => seeded(1) }) };
  }

  it("ルームを書き換えたら、そのルームの更新を知らせる", async () => {
    const { service, roomChanged } = withNotifier();
    await service.createRoom(alice);

    await service.join("room-1", bob);

    expect(roomChanged).toHaveBeenCalledWith("room-1");
  });

  it("ゲームが進んだとき（狙いを出しただけでも）知らせる", async () => {
    const { service, roomChanged } = withNotifier();
    await service.createRoom(alice);
    await service.join("room-1", bob);
    await service.startGame("room-1", alice);
    roomChanged.mockClear();
    const hand = (await service.getGame("room-1", alice)).myHand!.slice(0, 3).map((c) => c.id);

    await service.declareAims("room-1", alice, hand);

    expect(roomChanged).toHaveBeenCalledTimes(1);
  });

  it("何も変わらなかった（参加済みの人の開き直し）・失敗したときは知らせない", async () => {
    const { service, roomChanged } = withNotifier();
    await service.createRoom(alice);
    await service.join("room-1", bob);
    roomChanged.mockClear();

    await service.join("room-1", bob);
    await service.startGame("room-1", bob).catch(() => {});

    expect(roomChanged).not.toHaveBeenCalled();
  });
});

describe("CPU の手番", () => {
  async function started(humans: (typeof alice)[]) {
    const ctx = setup({ createRng: () => seeded(5) });
    await ctx.service.createRoom(humans[0]!);
    for (const h of humans.slice(1)) await ctx.service.join("room-1", h);
    await ctx.service.startGame("room-1", humans[0]!);
    return ctx;
  }

  const firstThree = async (service: RoomService, who: typeof alice) =>
    (await service.getGame("room-1", who)).myHand!.slice(0, 3).map((c) => c.id);

  it("人が投げたあと、次が CPU なら人の手番まで続けて進める", async () => {
    const { service } = await started([alice]);

    const view = await throwAll(service, alice, await firstThree(service, alice));

    // 1ラウンド目: Alice → CPU 1〜3。2ラウンド目は CPU 1 から始まり、CPU 1〜3 → Alice の手番
    expect(view.currentThrower).toBe("g-1");
    expect(view.round).toBe(2);
    expect(view.lastRoundThrows.map((t) => t.player)).toEqual(["g-1", "cpu-1", "cpu-2", "cpu-3"]);
    expect(view.throws.map((t) => t.player)).toEqual(["cpu-1", "cpu-2", "cpu-3"]);
  });

  it("次が人なら CPU は投げない", async () => {
    const { service } = await started([alice, bob]);

    const view = await throwAll(service, alice, await firstThree(service, alice));

    expect(view.currentThrower).toBe("g-2");
    expect(view.throws).toHaveLength(1);
  });

  it("1人と CPU 3人で最後まで遊べる", async () => {
    const { service } = await started([alice]);

    for (let i = 0; i < 200; i++) {
      const view = await service.getGame("room-1", alice);
      if (view.phase === "finished") break;
      await throwAll(service, alice, await firstThree(service, alice));
    }

    await expect(service.getRoom("room-1")).resolves.toMatchObject({ status: "finished" });
  });
});

describe("めくる（#30）", () => {
  async function declared() {
    const ctx = setup({ createRng: () => seeded(2) });
    await ctx.service.createRoom(alice);
    await ctx.service.join("room-1", bob);
    await ctx.service.startGame("room-1", alice);
    const aims = (await ctx.service.getGame("room-1", alice)).myHand!.slice(0, 3).map((c) => c.id);
    await ctx.service.declareAims("room-1", alice, aims);
    return ctx;
  }

  it("狙いを出すと、まだめくらずに全員に狙いが見える。手番は変わらない", async () => {
    const { service } = await declared();

    const bobs = await service.getGame("room-1", bob);

    expect(bobs.pending).toMatchObject({ player: "g-1", flips: [] });
    expect(bobs.pending!.aims).toHaveLength(3);
    expect(bobs.currentThrower).toBe("g-1");
    expect(bobs.throws).toEqual([]);
  });

  it("1枚ずつめくると、めくった札が全員に1枚ずつ見える", async () => {
    const { service } = await declared();

    await service.flip("room-1", alice, 1);
    await service.flip("room-1", alice, 1);

    await expect(service.getGame("room-1", bob)).resolves.toMatchObject({
      pending: { flips: { length: 2 } },
    });
  });

  it("めくる枚数が揃うと照合して次の人へ。残りを一気にめくってもよい", async () => {
    const { service } = await declared();

    await service.flip("room-1", alice, 1);
    const view = await service.flip("room-1", alice, "all");

    expect(view.pending).toBeNull();
    expect(view.throws).toHaveLength(1);
    expect(view.throws[0]!.flips).toHaveLength(5);
    expect(view.currentThrower).toBe("g-2");
  });

  it("めくれるのは狙いを出した人だけ（GAME_RULE）", async () => {
    const { service } = await declared();

    await expect(service.flip("room-1", bob, 1)).rejects.toMatchObject({ code: "GAME_RULE" });
  });

  it("1枚めくるたびに更新を知らせる（他の人の画面でも1枚ずつ開く）", async () => {
    const roomChanged = vi.fn(async () => {});
    const { service } = setup({ createRng: () => seeded(2), notifier: { roomChanged } });
    await service.createRoom(alice);
    await service.join("room-1", bob);
    await service.startGame("room-1", alice);
    const aims = (await service.getGame("room-1", alice)).myHand!.slice(0, 3).map((c) => c.id);
    await service.declareAims("room-1", alice, aims);
    roomChanged.mockClear();

    await service.flip("room-1", alice, 1);
    await service.flip("room-1", alice, 1);

    expect(roomChanged).toHaveBeenCalledTimes(2);
  });

  it("始まる前はめくれない", async () => {
    const { service } = setup();
    await service.createRoom(alice);

    await expect(service.flip("room-1", alice, 1)).rejects.toMatchObject({
      code: "GAME_NOT_STARTED",
    });
  });
});
