import { ApiRequestError } from "@app/web-core";
import { describe, expect, it, vi } from "vitest";
import { renameGuest } from "./rename";

const guest = { kind: "guest" as const, id: "g1", name: "新しい名前" };

describe("renameGuest", () => {
  it("前後の空白を除いた名前にする（まだゲストでなければ、その名前でゲストになる）", async () => {
    const ensure = vi.fn(async () => guest);

    await expect(renameGuest(ensure, "  新しい名前 ")).resolves.toEqual({ ok: true });
    expect(ensure).toHaveBeenCalledWith("新しい名前");
  });

  it("空・長すぎる名前は送らずに伝える", async () => {
    const ensure = vi.fn(async () => guest);

    await expect(renameGuest(ensure, "   ")).resolves.toEqual({
      ok: false,
      message: "名前を入れてください",
    });
    await expect(renameGuest(ensure, "あ".repeat(21))).resolves.toEqual({
      ok: false,
      message: "名前は20文字までです",
    });
    expect(ensure).not.toHaveBeenCalled();
  });

  it("変えられなければ、その理由を伝える", async () => {
    const ensure = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(0, "NETWORK_ERROR", "サーバーに接続できない"));

    await expect(renameGuest(ensure, "なまえ")).resolves.toEqual({
      ok: false,
      message: "サーバーに接続できない",
    });
  });
});
