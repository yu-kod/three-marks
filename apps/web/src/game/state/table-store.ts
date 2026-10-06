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
  /** turnEndsIn は今の手番の残り時間（ミリ秒）。手番が無ければ null */
  getGame(roomId: string): Promise<GameView & { turnEndsIn?: number | null }>;
};

/** 手番の残り時間が来てから、サーバーが代わりに進めた結果を読みに行くまでの余裕 */
const TURN_CHECK_MARGIN_MS = 500;

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

  /** 手番の残り時間が来たら取り直す（いなくなった人の手番は、誰かが読みに行ったときにサーバーが進める） */
  let turnCheck: ReturnType<typeof setTimeout> | null = null;
  function scheduleTurnCheck(turnEndsIn: number | null | undefined) {
    if (turnCheck !== null) clearTimeout(turnCheck);
    turnCheck = turnEndsIn == null ? null : setTimeout(refresh, turnEndsIn + TURN_CHECK_MARGIN_MS);
  }

  async function load(): Promise<{ next: TableState; turnEndsIn: number | null }> {
    const room = await api.getRoom(roomId);
    if (room.status === "waiting") {
      return { next: { status: "ready", room, game: null }, turnEndsIn: null };
    }
    const { turnEndsIn = null, ...game } = await api.getGame(roomId);
    return { next: { status: "ready", room, game }, turnEndsIn };
  }

  function refresh() {
    const request = ++latest;
    const isCurrent = () => request === latest;
    load().then(
      ({ next, turnEndsIn }) => {
        if (!isCurrent()) return;
        scheduleTurnCheck(turnEndsIn);
        set(next);
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

    /** 今すぐ取り直す。自分の操作のあと、知らせを待たずに結果を出すときに呼ぶ */
    refresh,

    /** 取り込みを始める。止めるときは戻り値を呼ぶ */
    start() {
      refresh();
      const unsubscribe = subscribe({ roomId, onChange: refresh });
      return () => {
        latest++;
        scheduleTurnCheck(null);
        unsubscribe();
      };
    },
  };
}

export type TableStore = ReturnType<typeof createTableStore>;
