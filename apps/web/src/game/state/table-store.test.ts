import { ApiRequestError } from "@app/web-core";
import { describe, expect, it, vi } from "vitest";
import { createTableStore, type TableApi } from "./table-store";
import type { RoomView } from "./types";
import { buildGameView, buildRoom } from "@/test-utils/table";

/** 手で解決できる API。呼ばれた順に返事を返せる */
function fakeApi(overrides: Partial<TableApi> = {}): TableApi {
  return {
    getRoom: vi.fn(async () => buildRoom()),
    getGame: vi.fn(async () => buildGameView()),
    ...overrides,
  };
}

/** subscribeRoomUpdates の代わり。onChange をテストから呼べる */
function fakeUpdates() {
  const updates = { onChange: () => {}, stopped: false };
  const subscribe = vi.fn(({ onChange }: { onChange: () => void }) => {
    updates.onChange = onChange;
    return () => {
      updates.stopped = true;
    };
  });
  return { updates, subscribe };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createTableStore", () => {
  it("始めるまでは loading。始めるとルームを取って ready になる（待合中はゲームを取らない）", async () => {
    const api = fakeApi();
    const store = createTableStore({ roomId: "r1", api, subscribe: fakeUpdates().subscribe });
    expect(store.getState()).toEqual({ status: "loading" });

    store.start();
    await flush();

    expect(store.getState()).toEqual({ status: "ready", room: buildRoom(), game: null });
    expect(api.getGame).not.toHaveBeenCalled();
  });

  it("ゲームが始まっていれば、自分に見えるゲームの状態も取る", async () => {
    const api = fakeApi({ getRoom: vi.fn(async () => buildRoom({ status: "playing" })) });
    const store = createTableStore({ roomId: "r1", api, subscribe: fakeUpdates().subscribe });

    store.start();
    await flush();

    expect(store.getState()).toEqual({
      status: "ready",
      room: buildRoom({ status: "playing" }),
      game: buildGameView(),
    });
  });

  it("ルームが変わった知らせで取り直し、変わったことを購読者に知らせる", async () => {
    const getRoom = vi
      .fn<TableApi["getRoom"]>()
      .mockResolvedValueOnce(buildRoom())
      .mockResolvedValueOnce(buildRoom({ status: "playing" }));
    const { updates, subscribe } = fakeUpdates();
    const store = createTableStore({ roomId: "r1", api: fakeApi({ getRoom }), subscribe });
    const listener = vi.fn();
    store.subscribe(listener);

    store.start();
    await flush();
    updates.onChange();
    await flush();

    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ roomId: "r1" }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ room: { status: "playing" }, game: buildGameView() });
  });

  it("購読をやめた人には知らせない。止めると更新の受け取りもやめる", async () => {
    const { updates, subscribe } = fakeUpdates();
    const store = createTableStore({ roomId: "r1", api: fakeApi(), subscribe });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    const stop = store.start();
    await flush();
    stop();

    expect(listener).not.toHaveBeenCalled();
    expect(updates.stopped).toBe(true);
  });

  it("最初に取れなければ、理由のコード付きで error になる", async () => {
    const getRoom = vi.fn(async () => {
      throw new ApiRequestError(404, "ROOM_NOT_FOUND", "ルームが見つからない");
    });
    const store = createTableStore({
      roomId: "r1",
      api: fakeApi({ getRoom }),
      subscribe: fakeUpdates().subscribe,
    });

    store.start();
    await flush();

    expect(store.getState()).toEqual({ status: "error", code: "ROOM_NOT_FOUND" });
  });

  it("一度取れたあとの取り直しに失敗しても、前の状態のまま次の知らせを待つ", async () => {
    const getRoom = vi
      .fn<TableApi["getRoom"]>()
      .mockResolvedValueOnce(buildRoom())
      .mockRejectedValueOnce(new ApiRequestError(0, "NETWORK_ERROR", "サーバーに接続できない"));
    const { updates, subscribe } = fakeUpdates();
    const store = createTableStore({ roomId: "r1", api: fakeApi({ getRoom }), subscribe });

    store.start();
    await flush();
    updates.onChange();
    await flush();

    expect(store.getState()).toEqual({ status: "ready", room: buildRoom(), game: null });
  });

  it("遅れて返ってきた古い応答で、新しい状態を上書きしない", async () => {
    let answerFirst: (room: RoomView) => void = () => {};
    const getRoom = vi
      .fn<TableApi["getRoom"]>()
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(buildRoom({ hostId: "new" }));
    const { updates, subscribe } = fakeUpdates();
    const store = createTableStore({ roomId: "r1", api: fakeApi({ getRoom }), subscribe });

    store.start();
    updates.onChange();
    await flush();
    answerFirst(buildRoom({ hostId: "old" }));
    await flush();

    expect(store.getState()).toMatchObject({ room: { hostId: "new" } });
  });

  it("止めたあとに返ってきた応答は反映しない", async () => {
    let answer: (room: RoomView) => void = () => {};
    const getRoom = vi.fn(() => new Promise<RoomView>((resolve) => (answer = resolve)));
    const store = createTableStore({
      roomId: "r1",
      api: fakeApi({ getRoom }),
      subscribe: fakeUpdates().subscribe,
    });

    const stop = store.start();
    stop();
    answer(buildRoom());
    await flush();

    expect(store.getState()).toEqual({ status: "loading" });
  });

  it("API のエラーでない失敗は UNKNOWN。止めたあとに失敗が返っても状態は変えない", async () => {
    const broken = createTableStore({
      roomId: "r1",
      api: fakeApi({ getRoom: vi.fn().mockRejectedValue(new TypeError("壊れた応答")) }),
      subscribe: fakeUpdates().subscribe,
    });
    const stopped = createTableStore({
      roomId: "r1",
      api: fakeApi({ getRoom: vi.fn().mockRejectedValue(new TypeError("壊れた応答")) }),
      subscribe: fakeUpdates().subscribe,
    });

    broken.start();
    stopped.start()();
    await flush();

    expect(broken.getState()).toEqual({ status: "error", code: "UNKNOWN" });
    expect(stopped.getState()).toEqual({ status: "loading" });
  });

  it("止めたあと、また始めれば取り込みを再開する（React の StrictMode は始める・止める・始めるの順に呼ぶ）", async () => {
    const store = createTableStore({
      roomId: "r1",
      api: fakeApi(),
      subscribe: fakeUpdates().subscribe,
    });

    store.start()();
    store.start();
    await flush();

    expect(store.getState()).toMatchObject({ status: "ready" });
  });

  it("refresh() で今すぐ取り直す（自分の操作の結果を、知らせを待たずに出す）", async () => {
    const getRoom = vi
      .fn<TableApi["getRoom"]>()
      .mockResolvedValueOnce(buildRoom())
      .mockResolvedValueOnce(buildRoom({ hostId: "next" }));
    const store = createTableStore({
      roomId: "r1",
      api: fakeApi({ getRoom }),
      subscribe: fakeUpdates().subscribe,
    });

    store.start();
    await flush();
    store.refresh();
    await flush();

    expect(store.getState()).toMatchObject({ room: { hostId: "next" } });
  });
});
