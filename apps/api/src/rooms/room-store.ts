import { ConflictError } from "@app/server-core";
import type { SeatDraw } from "@three-marks/engine";

export type RoomMember = {
  guestId: string;
  /** 参加したときの名前 */
  name: string;
  /** UNIX 秒 */
  joinedAt: number;
};

export type RoomRecord = {
  /** 招待 URL に入る。推測できない値にする */
  roomId: string;
  /** 作った人 */
  hostId: string;
  /** 席順（手番の順）。最初は参加した順で、ホストが並べ直すか、カードを引いて決める */
  members: RoomMember[];
  /** カードを引いて席順を決めたときの結果（解釈メモ12）。参加者や席順が変わったら null に戻す */
  seatDraw: SeatDraw[][] | null;
  /** UNIX 秒 */
  createdAt: number;
  /** UNIX 秒。過ぎたら無効（DynamoDB の TTL もこの属性で消す） */
  expiresAt: number;
  /** 楽観ロックの版。書き込むたびに1つ進む */
  version: number;
};

export type RoomStore = {
  /** 新規作成。同じ ID が既にあれば ConflictError */
  create(room: RoomRecord): Promise<void>;
  find(roomId: string): Promise<RoomRecord | null>;
  /**
   * 読んだときの版（room.version）のままなら書き込み、版を1つ進める。
   * 他の書き込みが先にあった（版が違う）か、ルームが無ければ ConflictError。
   * 呼び出し側は読み直してやり直す。
   */
  save(room: RoomRecord): Promise<void>;
};

const copy = (room: RoomRecord): RoomRecord => ({
  ...room,
  members: room.members.map((m) => ({ ...m })),
});

/** ローカル開発とテスト用。プロセスが終われば消える */
export function createInMemoryRoomStore(): RoomStore {
  const rooms = new Map<string, RoomRecord>();

  return {
    async create(room) {
      if (rooms.has(room.roomId)) {
        throw new ConflictError("同じ ID のルームが既にある");
      }
      rooms.set(room.roomId, copy(room));
    },

    async find(roomId) {
      const room = rooms.get(roomId);
      return room ? copy(room) : null;
    },

    async save(room) {
      if (rooms.get(room.roomId)?.version !== room.version) {
        throw new ConflictError("ルームが他の操作で更新された");
      }
      rooms.set(room.roomId, copy({ ...room, version: room.version + 1 }));
    },
  };
}
