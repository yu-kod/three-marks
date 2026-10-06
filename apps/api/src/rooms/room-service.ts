import { randomBytes } from "node:crypto";
import type { GuestIdentity } from "@app/identity";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@app/server-core";
import { randomInt } from "node:crypto";
import {
  chooseAims,
  createGame,
  currentThrower,
  declareAims as declareInGame,
  revealFlips as revealInGame,
  throwCards as throwInGame,
  createRng as seededRng,
  playForAbsent,
  drawSeats as drawSeatOrder,
  MAX_PLAYERS,
  rulesFor,
  type Rng,
  type SeatDraw,
  viewFor,
  type GameView,
  type GameState,
} from "@three-marks/engine";
import { silentNotifier, type RoomNotifier } from "../realtime/notifier.js";
import { withGameRules } from "./game-errors.js";
import type { RoomMember, RoomRecord, RoomStore } from "./room-store.js";

/** 手番が回ってきてから、サーバーが代わりに進めるまでの時間（解釈メモ17） */
export const TURN_TIMEOUT_MS = 60_000;

/** ゲームの状態に、今の手番が終わるまでの残り時間（ミリ秒）を添えたもの。手番が無ければ null */
export type TimedGameView = GameView & { turnEndsIn: number | null };

/** ルームの有効期間。集まって遊び終わるまでに十分な長さ */
export const ROOM_TTL_SECONDS = 24 * 60 * 60;

/** クライアントへ返すルーム */
export type RoomView = {
  id: string;
  hostId: string;
  /** 席順。ゲームが始まると、空いた席を埋めた CPU（cpu: true）も入る */
  members: { id: string; name: string; cpu: boolean }[];
  maxPlayers: number;
  /** カードを引いて席順を決めたときの結果。引いていなければ null */
  seatDraw: SeatDraw[][] | null;
  /** waiting: 集まっている / playing: ゲーム中 / finished: 終わった */
  status: "waiting" | "playing" | "finished";
};

export type RoomServiceDeps = {
  store: RoomStore;
  /** 現在時刻（ミリ秒） */
  now?: () => number;
  generateId?: () => string;
  /** 席順を引く・ゲームを進めるときの乱数。使うたびに新しいシードで作る（シードはクライアントに出さない） */
  createRng?: () => Rng;
  /** ルームを書き換えたあとに、そのルームの接続へ知らせる（WebSocket） */
  notifier?: RoomNotifier;
};

/** 同時の書き込みに負けたとき、読み直してやり直す回数の上限 */
const SAVE_ATTEMPTS = 3;

/** 72 ビット。URL にそのまま入る（base64url の12文字） */
const generateRoomId = () => randomBytes(9).toString("base64url");

const toView = (room: RoomRecord): RoomView => ({
  id: room.roomId,
  hostId: room.hostId,
  members: room.members.map((m) => ({ id: m.guestId, name: m.name, cpu: m.cpu === true })),
  maxPlayers: MAX_PLAYERS,
  seatDraw: room.seatDraw,
  status: room.game === null ? "waiting" : room.game.phase === "finished" ? "finished" : "playing",
});

function requireGame(room: RoomRecord): GameState {
  if (room.game === null) {
    throw new NotFoundError("ゲームはまだ始まっていない", "GAME_NOT_STARTED");
  }
  return room.game;
}

/** 4人に足りない席を CPU で埋める。席順は人の後ろ（解釈メモ13） */
function withCpus(members: RoomMember[], joinedAt: number): RoomMember[] {
  const cpus = Array.from({ length: MAX_PLAYERS - members.length }, (_, i) => ({
    guestId: `cpu-${i + 1}`,
    name: `CPU ${i + 1}`,
    joinedAt,
    cpu: true as const,
  }));
  return [...members, ...cpus];
}

/** 次が CPU なら、人の手番かゲームの終わりまで CPU に投げさせる（CPU は自分に見える情報だけで選ぶ） */
function playCpuTurns(game: GameState, members: RoomMember[], rng: Rng): GameState {
  const cpus = new Set(members.filter((m) => m.cpu).map((m) => m.guestId));
  let state = game;
  // めくっている途中（人がまだめくり終えていない）なら進めない
  while (state.phase === "throwing" && state.pending === null && cpus.has(currentThrower(state))) {
    const cpu = currentThrower(state);
    state = throwInGame(state, cpu, chooseAims(viewFor(state, cpu), rng), rng);
  }
  return state;
}

/** 今の手番を表す鍵（ラウンドと投げる人）。投げている最中でなければ null */
const turnKey = (game: GameState) =>
  game.phase === "throwing" ? `${game.round}:${currentThrower(game)}` : null;

/** 席に関わる変更（参加・退出・席順）はゲームを始める前だけ */
function assertWaiting(room: RoomRecord) {
  if (room.game !== null) {
    throw new UnprocessableError("ゲームはもう始まっている", "GAME_STARTED");
  }
}

const randomRng = () => seededRng(randomInt(2 ** 32));

/**
 * ルーム（ゲームを始める前の集まり）。招待 URL に入る ID を知っている人だけが参加できる。
 */
export function createRoomService({
  store,
  now = Date.now,
  generateId = generateRoomId,
  createRng = randomRng,
  notifier = silentNotifier,
}: RoomServiceDeps) {
  const nowSeconds = () => Math.floor(now() / 1000);

  /** 期限切れは無いものとして扱う（DynamoDB の TTL は消すのが最大で数日遅れる） */
  async function findValid(roomId: string): Promise<RoomRecord> {
    const room = await store.find(roomId);
    if (room === null || room.expiresAt <= nowSeconds()) {
      throw new NotFoundError(
        "ルームが見つからない（期限が切れたか、URL が違う）",
        "ROOM_NOT_FOUND"
      );
    }
    return room;
  }

  /**
   * 読んで、変えて、版を条件に書く。他の書き込みに負けたら読み直してやり直す。
   * change が null を返したら書かない（変える必要が無い）。
   */
  async function updateRecord(
    roomId: string,
    change: (room: RoomRecord) => RoomRecord | null
  ): Promise<RoomRecord> {
    for (let attempt = 1; ; attempt++) {
      const room = await findValid(roomId);
      const changed = change(room);
      if (changed === null) {
        return room;
      }
      try {
        await store.save(changed);
        await notifier.roomChanged(roomId);
        return changed;
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt >= SAVE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  /** ゲームを書き換える。手番が変わったら、回ってきた時刻を覚え直す */
  function withGame(room: RoomRecord, game: GameState): RoomRecord {
    const key = turnKey(game);
    const turn =
      key === null ? null : room.turn?.key === key ? room.turn : { key, startedAt: now() };
    return { ...room, game, turn };
  }

  /** 手番が回ってきてから時間を過ぎているか（CPU の手番では待たないので人の手番だけ） */
  const timedOut = (room: RoomRecord) =>
    room.game !== null &&
    room.turn != null &&
    room.turn.key === turnKey(room.game) &&
    now() - room.turn.startedAt >= TURN_TIMEOUT_MS;

  /** updateRecord して、クライアントへ返すルームにする */
  const update = async (roomId: string, change: (room: RoomRecord) => RoomRecord | null) =>
    toView(await updateRecord(roomId, change));

  return {
    async createRoom(host: GuestIdentity): Promise<RoomView> {
      const createdAt = nowSeconds();
      const room: RoomRecord = {
        roomId: generateId(),
        hostId: host.id,
        members: [{ guestId: host.id, name: host.name, joinedAt: createdAt }],
        createdAt,
        expiresAt: createdAt + ROOM_TTL_SECONDS,
        seatDraw: null,
        game: null,
        version: 1,
      };
      await store.create(room);
      return toView(room);
    },

    async getRoom(roomId: string): Promise<RoomView> {
      return toView(await findValid(roomId));
    },

    /** 参加する。参加済みなら何もしない（招待 URL を開き直しても増えない） */
    join: (roomId: string, guest: GuestIdentity) =>
      update(roomId, (room) => {
        if (room.members.some((m) => m.guestId === guest.id)) {
          return null;
        }
        assertWaiting(room);
        if (room.members.length >= MAX_PLAYERS) {
          throw new UnprocessableError(`ルームは満員（${MAX_PLAYERS}人まで）`, "ROOM_FULL");
        }
        return {
          ...room,
          // 全員が離れたルームでは、最初に戻ってきた人がホストになる
          hostId: room.members.length === 0 ? guest.id : room.hostId,
          seatDraw: null,
          members: [
            ...room.members,
            { guestId: guest.id, name: guest.name, joinedAt: nowSeconds() },
          ],
        };
      }),

    /** 席を離れる。後ろの人の席は詰まる。ホストが離れたら次に参加した人がホストになる */
    leave: (roomId: string, guest: GuestIdentity) =>
      update(roomId, (room) => {
        if (!room.members.some((m) => m.guestId === guest.id)) {
          return null;
        }
        assertWaiting(room);
        const members = room.members.filter((m) => m.guestId !== guest.id);
        // 最後の1人が離れたらホストはそのまま（次に参加した人に移る。join を参照）
        const hostId =
          room.hostId === guest.id ? (members[0]?.guestId ?? room.hostId) : room.hostId;
        return { ...room, hostId, members, seatDraw: null };
      }),

    /**
     * ホストが席の並び（手番の順）を決める。order は今の参加者の ID をちょうど1回ずつ並べたもの。
     * 読んでから書くまでに誰かが参加・退出していたら、並びが一致しなくなって弾かれる。
     */
    arrangeSeats: (roomId: string, host: GuestIdentity, order: string[]) =>
      update(roomId, (room) => {
        if (room.hostId !== host.id) {
          throw new ForbiddenError("席の並びを決められるのはホストだけ");
        }
        assertWaiting(room);
        const byId = new Map(room.members.map((m) => [m.guestId, m]));
        const members = order.map((id) => byId.get(id));
        if (
          order.length !== room.members.length ||
          new Set(order).size !== order.length ||
          members.includes(undefined)
        ) {
          throw new UnprocessableError("席の並びが今の参加者と一致しない", "SEATS_MISMATCH");
        }
        return { ...room, members: members as RoomRecord["members"], seatDraw: null };
      }),

    /** ホストがカードを引いて席順を決める（解釈メモ12）。誰が何を引いたかをルームに残す */
    drawSeats: (roomId: string, host: GuestIdentity) =>
      update(roomId, (room) => {
        if (room.hostId !== host.id) {
          throw new ForbiddenError("席順を決められるのはホストだけ");
        }
        assertWaiting(room);
        const byId = new Map(room.members.map((m) => [m.guestId, m]));
        const { order, rounds } = drawSeatOrder(
          room.members.map((m) => m.guestId),
          rulesFor(MAX_PLAYERS),
          createRng()
        );
        return { ...room, members: order.map((id) => byId.get(id)!), seatDraw: rounds };
      }),

    /**
     * ホストがゲームを始める。4人に足りない席は CPU が埋め、席順のまま1番目の席から（解釈メモ11・13）。
     * 1人でも始められる。
     */
    startGame: (roomId: string, host: GuestIdentity) =>
      update(roomId, (room) => {
        if (room.hostId !== host.id) {
          throw new ForbiddenError("ゲームを始められるのはホストだけ");
        }
        assertWaiting(room);
        const members = withCpus(room.members, nowSeconds());
        const rng = createRng();
        const game = createGame(
          members.map((m) => m.guestId),
          rng
        );
        return withGame({ ...room, members }, playCpuTurns(game, members, rng));
      }),

    /**
     * 手番の人が手札から狙いを出す（4.2）。まだめくらない（#30）。狙いは全員に見える。
     * 返すのは出した人に見せてよい状態だけ。
     */
    async declareAims(roomId: string, player: GuestIdentity, aimIds: number[]): Promise<GameView> {
      const room = await updateRecord(roomId, (room) => {
        const game = requireGame(room);
        return withGame(
          room,
          withGameRules(() => declareInGame(game, player.id, aimIds))
        );
      });
      return viewFor(room.game!, player.id);
    },

    /**
     * 狙いを出した人が山札の上からめくる。count 枚か、"all" で残りを全部。
     * めくり終われば照合して次の人へ。全員が投げ終わればラウンドの終わり（4.4）まで、
     * 次が CPU なら人の手番か終わりまで進める。1枚めくるたびに書いて知らせるので、他の人の画面でも1枚ずつ開く。
     */
    async flip(roomId: string, player: GuestIdentity, count: number | "all"): Promise<GameView> {
      const room = await updateRecord(roomId, (room) => {
        const game = requireGame(room);
        const rng = createRng();
        const n = count === "all" ? game.rules.flipCount : count;
        const flipped = withGameRules(() => revealInGame(game, player.id, n, rng));
        return withGame(room, playCpuTurns(flipped, room.members, rng));
      });
      return viewFor(room.game!, player.id);
    },

    /**
     * viewer に見せてよいゲームの状態と、今の手番の残り時間。参加者でなければ観戦者として見る。
     * 手番の人が時間を過ぎても投げ終えていなければ、ここでサーバーが代わりに進める（解釈メモ17）
     */
    async getGame(roomId: string, viewer: GuestIdentity | null): Promise<TimedGameView> {
      let room = await findValid(roomId);
      if (timedOut(room)) {
        room = await updateRecord(roomId, (room) => {
          if (!timedOut(room)) return null;
          const rng = createRng();
          return withGame(room, playCpuTurns(playForAbsent(room.game!, rng), room.members, rng));
        });
      }
      const game = requireGame(room);
      const turnEndsIn =
        room.turn != null && room.turn.key === turnKey(game)
          ? Math.max(0, room.turn.startedAt + TURN_TIMEOUT_MS - now())
          : null;
      return { ...viewFor(game, viewer?.id ?? null), turnEndsIn };
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
