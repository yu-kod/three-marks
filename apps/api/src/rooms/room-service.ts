import { randomBytes } from "node:crypto";
import type { GuestIdentity } from "@app/identity";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableError } from "@app/server-core";
import { randomInt } from "node:crypto";
import {
  createGame,
  throwCards as throwInGame,
  createRng as seededRng,
  drawSeats as drawSeatOrder,
  MAX_PLAYERS,
  MIN_PLAYERS,
  rulesFor,
  type Rng,
  type SeatDraw,
  viewFor,
  type GameView,
  type GameState,
} from "@three-marks/engine";
import { silentNotifier, type RoomNotifier } from "../realtime/notifier.js";
import { withGameRules } from "./game-errors.js";
import type { RoomRecord, RoomStore } from "./room-store.js";

/** ルームの有効期間。集まって遊び終わるまでに十分な長さ */
export const ROOM_TTL_SECONDS = 24 * 60 * 60;

/** クライアントへ返すルーム */
export type RoomView = {
  id: string;
  hostId: string;
  /** 参加した順 */
  members: { id: string; name: string }[];
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
  members: room.members.map((m) => ({ id: m.guestId, name: m.name })),
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

    /** ホストがゲームを始める。席順のまま、1番目の席から（解釈メモ11） */
    startGame: (roomId: string, host: GuestIdentity) =>
      update(roomId, (room) => {
        if (room.hostId !== host.id) {
          throw new ForbiddenError("ゲームを始められるのはホストだけ");
        }
        assertWaiting(room);
        if (room.members.length < MIN_PLAYERS) {
          throw new UnprocessableError(
            `${MIN_PLAYERS}人そろったら始められる`,
            "NOT_ENOUGH_PLAYERS"
          );
        }
        return {
          ...room,
          game: createGame(
            room.members.map((m) => m.guestId),
            createRng()
          ),
        };
      }),

    /**
     * 手番の人が手札から狙いを出して投げる（4.2）。全員が投げ終わればラウンドの終わり（4.4）までエンジンが進める。
     * 返すのは投げた人に見せてよい状態だけ。
     */
    async throwCards(roomId: string, player: GuestIdentity, aimIds: number[]): Promise<GameView> {
      const room = await updateRecord(roomId, (room) => {
        const game = requireGame(room);
        return {
          ...room,
          game: withGameRules(() => throwInGame(game, player.id, aimIds, createRng())),
        };
      });
      return viewFor(room.game!, player.id);
    },

    /** viewer に見せてよいゲームの状態。参加者でなければ観戦者として見る */
    async getGame(roomId: string, viewer: GuestIdentity | null): Promise<GameView> {
      return viewFor(requireGame(await findValid(roomId)), viewer?.id ?? null);
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
