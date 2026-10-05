import { randomBytes } from "node:crypto";
import type { GuestIdentity } from "@app/identity";
import { ConflictError, NotFoundError, UnprocessableError } from "@app/server-core";
import { MAX_PLAYERS } from "@three-marks/engine";
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
};

export type RoomServiceDeps = {
  store: RoomStore;
  /** 現在時刻（ミリ秒） */
  now?: () => number;
  generateId?: () => string;
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
});

/**
 * ルーム（ゲームを始める前の集まり）。招待 URL に入る ID を知っている人だけが参加できる。
 */
export function createRoomService({
  store,
  now = Date.now,
  generateId = generateRoomId,
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
  async function update(
    roomId: string,
    change: (room: RoomRecord) => RoomRecord | null
  ): Promise<RoomView> {
    for (let attempt = 1; ; attempt++) {
      const room = await findValid(roomId);
      const changed = change(room);
      if (changed === null) {
        return toView(room);
      }
      try {
        await store.save(changed);
        return toView(changed);
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt >= SAVE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  return {
    async createRoom(host: GuestIdentity): Promise<RoomView> {
      const createdAt = nowSeconds();
      const room: RoomRecord = {
        roomId: generateId(),
        hostId: host.id,
        members: [{ guestId: host.id, name: host.name, joinedAt: createdAt }],
        createdAt,
        expiresAt: createdAt + ROOM_TTL_SECONDS,
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
        if (room.members.length >= MAX_PLAYERS) {
          throw new UnprocessableError(`ルームは満員（${MAX_PLAYERS}人まで）`, "ROOM_FULL");
        }
        return {
          ...room,
          members: [
            ...room.members,
            { guestId: guest.id, name: guest.name, joinedAt: nowSeconds() },
          ],
        };
      }),
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
