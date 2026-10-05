import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MountTable } from "./TableCanvas";
import { TablePage } from "./TablePage";
import { parseSkin } from "@/game/skin/skin";
import { createTableStore, type TableStore } from "@/game/state/table-store";
import { buildManifest } from "@/test-utils/skin";
import { renderWithProviders } from "@/test-utils/render";

const skin = parseSkin(
  buildManifest({ id: "night" }),
  "https://example.com/skins/night/manifest.json"
);

function setup(overrides: { loadSkin?: () => Promise<typeof skin> } = {}) {
  const stop = vi.fn();
  const store: TableStore = {
    ...createTableStore({
      roomId: "x",
      api: { getRoom: vi.fn(), getGame: vi.fn() },
      subscribe: () => () => {},
    }),
    start: vi.fn(() => stop),
  };
  const createStore = vi.fn(() => store);
  const mount = vi.fn<MountTable>(async () => () => {});
  const view = renderWithProviders(
    <Routes>
      <Route
        path="/r/:id"
        element={
          <TablePage
            loadSkin={overrides.loadSkin ?? (async () => skin)}
            createStore={createStore}
            mount={mount}
          />
        }
      />
    </Routes>,
    { route: "/r/room-1" }
  );
  return { ...view, store, stop, createStore, mount };
}

describe("TablePage", () => {
  it("URL のルームの状態を取り込み、保存されたスキンで描かせる", async () => {
    const { store, createStore, mount } = setup();

    const container = await screen.findByRole("region", { name: "ゲーム画面" });

    expect(createStore).toHaveBeenCalledWith("room-1");
    expect(store.start).toHaveBeenCalled();
    expect(mount).toHaveBeenCalledWith(container, { skin, store });
  });

  it("画面を離れたら取り込みをやめる", async () => {
    const { unmount, stop } = setup();
    await screen.findByRole("region", { name: "ゲーム画面" });

    unmount();

    expect(stop).toHaveBeenCalled();
  });

  it("スキンを読み込めなければ、そう伝える", async () => {
    setup({ loadSkin: async () => Promise.reject(new Error("404")) });

    expect(await screen.findByRole("alert")).toHaveTextContent("画面を読み込めませんでした");
  });
});
