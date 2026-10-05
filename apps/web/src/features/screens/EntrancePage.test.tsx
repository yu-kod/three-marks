import { screen as view } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EntrancePage } from "./EntrancePage";
import type { MountGame } from "@/features/table/GameCanvas";
import type { Screen } from "@/game/screens";
import { parseSkin } from "@/game/skin/skin";
import { renderWithProviders } from "@/test-utils/render";
import { buildManifest } from "@/test-utils/skin";

const skin = parseSkin(buildManifest(), "https://example.com/skins/standard/manifest.json");

function setup(
  createRoom?: () => Promise<{ ok: true; roomId: string } | { ok: false; message: string }>
) {
  let shown = null as Screen | null;
  const mount = vi.fn<MountGame>(async (_parent, { screen }) => {
    shown = screen;
    return () => {};
  });
  renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={<EntrancePage loadSkin={async () => skin} createRoom={createRoom} mount={mount} />}
      />
      <Route path="/r/:id" element={<p>ルームの画面</p>} />
    </Routes>
  );
  const screen = () => {
    if (shown?.kind !== "entrance") throw new Error("入口ではない");
    return shown;
  };
  return { screen };
}

describe("EntrancePage", () => {
  it("入口を描かせ、ルームを作れたらそのルームの画面へ移る", async () => {
    const { screen } = setup(async () => ({ ok: true, roomId: "new-room" }));
    await view.findByRole("region", { name: "ゲーム画面" });
    await vi.waitFor(() => screen());

    await expect(screen().createRoom()).resolves.toEqual({ ok: true });

    expect(await view.findByText("ルームの画面")).toBeInTheDocument();
  });

  it("作れなければ、その言葉を入口に返す（画面は移らない）", async () => {
    const { screen } = setup(async () => ({ ok: false, message: "サーバーに接続できない" }));
    await vi.waitFor(() => screen());

    await expect(screen().createRoom()).resolves.toEqual({
      ok: false,
      message: "サーバーに接続できない",
    });
    expect(view.queryByText("ルームの画面")).not.toBeInTheDocument();
  });

  it("既定では、このブラウザのゲストとして API でルームを作る", async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith("/api/guests")
        ? Response.json(
            { guest: { kind: "guest", id: "g1", name: "あなた" }, token: "t" },
            { status: 201 }
          )
        : Response.json({ room: { id: "made-by-api" } }, { status: 201 })
    );
    vi.stubGlobal("fetch", fetchFn);
    const { screen } = setup();
    await vi.waitFor(() => screen());

    await screen().createRoom();

    expect(await view.findByText("ルームの画面")).toBeInTheDocument();
    expect(fetchFn.mock.calls.map(([url]) => url)).toContain("/api/rooms");
  });
});
