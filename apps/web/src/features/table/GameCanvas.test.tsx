import { render, screen as view } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameCanvas, type MountGame } from "./GameCanvas";
import { parseSkin } from "@/game/skin/skin";
import { entranceScreen } from "@/test-utils/screens";
import { buildManifest } from "@/test-utils/skin";

const skin = parseSkin(buildManifest(), "https://example.com/skins/standard/manifest.json");
const screen = entranceScreen();

describe("GameCanvas", () => {
  it("ゲーム画面の入れ物に、スキンと画面を渡して描かせる", async () => {
    const mount = vi.fn<MountGame>(async () => () => {});

    render(<GameCanvas skin={skin} screen={screen} mount={mount} />);

    const container = view.getByRole("region", { name: "ゲーム画面" });
    expect(mount).toHaveBeenCalledWith(container, {
      skin,
      screen,
      signal: expect.any(AbortSignal),
    });
  });

  it("画面を離れたら描画を片付ける（描き始める前に離れても）", async () => {
    const destroy = vi.fn();
    let ready: (destroy: () => void) => void = () => {};
    const mount = vi.fn<MountGame>(() => new Promise((resolve) => (ready = resolve)));

    const { unmount } = render(<GameCanvas skin={skin} screen={screen} mount={mount} />);
    unmount();
    ready(destroy);
    await vi.waitFor(() => expect(destroy).toHaveBeenCalled());
  });

  it("描き始めたあとに離れても片付ける", async () => {
    const destroy = vi.fn();
    const mount = vi.fn<MountGame>(async () => destroy);

    const { unmount } = render(<GameCanvas skin={skin} screen={screen} mount={mount} />);
    await vi.waitFor(() => expect(mount).toHaveBeenCalled());
    await Promise.resolve();
    unmount();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("離れたら、まだ描き始めていない mount に中止を知らせる（二重に描かない。StrictMode は付けて外して付け直す）", async () => {
    const mount = vi.fn<MountGame>(async () => () => {});

    const { unmount } = render(<GameCanvas skin={skin} screen={screen} mount={mount} />);
    const { signal } = mount.mock.calls[0]![1];
    expect(signal.aborted).toBe(false);
    unmount();

    expect(signal.aborted).toBe(true);
  });
});
