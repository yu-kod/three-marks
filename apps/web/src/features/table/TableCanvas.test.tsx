import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableCanvas, type MountTable } from "./TableCanvas";
import { createTableStore } from "@/game/state/table-store";
import { parseSkin } from "@/game/skin/skin";
import { buildManifest } from "@/test-utils/skin";

const skin = parseSkin(buildManifest(), "https://example.com/skins/standard/manifest.json");
const store = createTableStore({
  roomId: "r1",
  api: { getRoom: vi.fn(), getGame: vi.fn() },
  subscribe: () => () => {},
});

describe("TableCanvas", () => {
  it("ゲーム画面の入れ物に、スキンとストアを渡して描かせる", async () => {
    const mount = vi.fn<MountTable>(async () => () => {});

    render(<TableCanvas skin={skin} store={store} mount={mount} />);

    const container = screen.getByRole("region", { name: "ゲーム画面" });
    expect(mount).toHaveBeenCalledWith(container, { skin, store });
  });

  it("画面を離れたら描画を片付ける（描き始める前に離れても）", async () => {
    const destroy = vi.fn();
    let ready: (destroy: () => void) => void = () => {};
    const mount = vi.fn<MountTable>(() => new Promise((resolve) => (ready = resolve)));

    const { unmount } = render(<TableCanvas skin={skin} store={store} mount={mount} />);
    unmount();
    ready(destroy);
    await vi.waitFor(() => expect(destroy).toHaveBeenCalled());
  });

  it("描き始めたあとに離れても片付ける", async () => {
    const destroy = vi.fn();
    const mount = vi.fn<MountTable>(async () => destroy);

    const { unmount } = render(<TableCanvas skin={skin} store={store} mount={mount} />);
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());
    await Promise.resolve();
    unmount();

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
