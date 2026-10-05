import { act, screen as view } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RoomPage } from "./RoomPage";
import type { MountGame } from "@/features/table/GameCanvas";
import type { Screen } from "@/game/screens";
import { parseSkin } from "@/game/skin/skin";
import { createTableStore, type TableStore } from "@/game/state/table-store";
import { renderWithProviders } from "@/test-utils/render";
import { idleGuest } from "@/test-utils/screens";
import { buildManifest } from "@/test-utils/skin";
import { buildRoom } from "@/test-utils/table";

const skin = parseSkin(buildManifest(), "https://example.com/skins/standard/manifest.json");

function setup() {
  const stop = vi.fn();
  const store: TableStore = {
    ...createTableStore({
      roomId: "x",
      api: { getRoom: vi.fn(), getGame: vi.fn() },
      subscribe: () => () => {},
    }),
    start: vi.fn(() => stop),
    refresh: vi.fn(),
  };
  const createStore = vi.fn(() => store);
  const session = idleGuest();
  vi.spyOn(session, "ensure").mockResolvedValue({ kind: "guest", id: "g1", name: "あなた" });
  const request = vi.fn(async (_path: string, _init?: unknown) => ({ room: buildRoom() }));
  const share = vi.fn(async () => {});
  let shown = null as Screen | null;
  const mount = vi.fn<MountGame>(async (_parent, { screen }) => {
    shown = screen;
    return () => {};
  });
  const view_ = renderWithProviders(
    <Routes>
      <Route path="/" element={<p>入口</p>} />
      <Route
        path="/r/:id"
        element={
          <RoomPage
            loadSkin={async () => skin}
            createStore={createStore}
            session={session}
            client={{ request } as never}
            shareTarget={{ share }}
            mount={mount}
          />
        }
      />
    </Routes>,
    { route: "/r/room-1" }
  );
  const room = () => {
    if (shown?.kind !== "room") throw new Error("ルームの画面ではない");
    return shown;
  };
  return { ...view_, store, stop, createStore, session, request, share, room };
}

describe("RoomPage", () => {
  it("URL のルームの状態を取り込み、ルームの画面を描かせる。離れたら取り込みをやめる", async () => {
    const { store, stop, createStore, session, room, unmount } = setup();
    await view.findByRole("region", { name: "ゲーム画面" });

    await vi.waitFor(() => expect(room()).toMatchObject({ kind: "room", store, guest: session }));
    expect(createStore).toHaveBeenCalledWith("room-1");
    expect(store.start).toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("参加・退出はこのルームに対して行い、すぐ取り直す", async () => {
    const { request, store, room } = setup();
    await vi.waitFor(() => room());

    await room().actions.join();
    await room().actions.leave();

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/api/rooms/room-1/join",
      "/api/rooms/room-1/leave",
    ]);
    expect(store.refresh).toHaveBeenCalledTimes(2);
  });

  it("共有では、このルームの招待 URL を送る", async () => {
    const { share, room } = setup();
    await vi.waitFor(() => room());

    await room().actions.share();

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${window.location.origin}/r/room-1` })
    );
  });

  it("名前を変えると、このブラウザのゲストの名前が変わる", async () => {
    const { session, room } = setup();
    await vi.waitFor(() => room());

    await expect(room().rename(" ねむいネコ ")).resolves.toEqual({ ok: true });

    expect(session.ensure).toHaveBeenCalledWith("ねむいネコ");
  });

  it("入口へ戻れる（ゲームが終わったあと）", async () => {
    const { room } = setup();
    await vi.waitFor(() => room());

    act(() => room().home());

    expect(await view.findByText("入口")).toBeInTheDocument();
  });
});
