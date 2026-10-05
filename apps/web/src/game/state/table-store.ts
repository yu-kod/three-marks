import { ApiRequestError } from "@app/web-core";
import type { GameView } from "@three-marks/engine";
import type { RoomView } from "./types";

/** 画面が読むテーブルの状態。画面はこれを描くだけで、ルールの判定はしない */
export type TableState =
  | { status: "loading" }
  | { status: "ready"; room: RoomView; game: GameView | null }
  /** 最初の読み込みに失敗した。code は API のエラーコード（ROOM_NOT_FOUND など） */
  | { status: "error"; code: string };

/** ストアが使う API（テストで差し替える） */
export type TableApi = {
  getRoom(roomId: string): Promise<RoomView>;
  getGame(roomId: string): Promise<GameView>;
};

/** subscribeRoomUpdates と同じ形（url などは呼ぶ側で埋める） */
export type SubscribeUpdates = (options: { roomId: string; onChange: () => void }) => () => void;

export type TableStoreOptions = {
  roomId: string;
  api: TableApi;
  subscribe: SubscribeUpdates;
};

export function createTableStore({ roomId, api, subscribe }: TableStoreOptions) {
  let state: TableState = { status: "loading" };
  const listeners = new Set<() => void>();

  function set(next: TableState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  /** 取り直しの通し番号。最後に始めた取り直しの応答だけを反映する（止めるときも進めて、途中の応答を捨てる） */
  let latest = 0;

  async function load(): Promise<TableState> {
    const room = await api.getRoom(roomId);
    const game = room.status === "waiting" ? null : await api.getGame(roomId);
    return { status: "ready", room, game };
  }

  function refresh() {
    const request = ++latest;
    const isCurrent = () => request === latest;
    load().then(
      (next) => {
        if (isCurrent()) set(next);
      },
      (error: unknown) => {
        // 一度取れたあとの失敗は、前の状態のまま次の知らせ（またはポーリング）で取り直す
        if (isCurrent() && state.status !== "ready") {
          set({ status: "error", code: error instanceof ApiRequestError ? error.code : "UNKNOWN" });
        }
      }
    );
  }

  return {
    getState: () => state,

    /** 状態が変わったら呼ばれる。やめるときは戻り値を呼ぶ */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** 取り込みを始める。止めるときは戻り値を呼ぶ */
    start() {
      refresh();
      const unsubscribe = subscribe({ roomId, onChange: refresh });
      return () => {
        latest++;
        unsubscribe();
      };
    },
  };
}

export type TableStore = ReturnType<typeof createTableStore>;
