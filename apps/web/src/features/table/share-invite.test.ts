import { describe, expect, it, vi } from "vitest";
import { shareInvite } from "./share-invite";

const URL_ = "https://three-marks.example/r/abc";

describe("shareInvite", () => {
  it("共有の画面が使えれば、それで送る（送り終えたら何も言わない）", async () => {
    const share = vi.fn(async () => {});

    await expect(shareInvite(URL_, { share })).resolves.toEqual({ ok: true, message: null });
    expect(share).toHaveBeenCalledWith({ title: "THREE MARKS", text: "一緒に遊ぼう", url: URL_ });
  });

  it("共有の画面を閉じただけなら、失敗とは言わない", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));

    await expect(shareInvite(URL_, { share })).resolves.toEqual({ ok: true, message: null });
  });

  it("共有が使えなければ（失敗しても）URL をコピーする", async () => {
    const writeText = vi.fn(async () => {});

    await expect(shareInvite(URL_, { clipboard: { writeText } })).resolves.toEqual({
      ok: true,
      message: "招待 URL をコピーしました",
    });
    await expect(
      shareInvite(URL_, {
        share: vi.fn().mockRejectedValue(new Error("x")),
        clipboard: { writeText },
      })
    ).resolves.toMatchObject({ ok: true });
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it("どちらもできなければ、URL を見せて伝える", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));

    await expect(shareInvite(URL_, { clipboard: { writeText } })).resolves.toEqual({
      ok: false,
      message: `コピーできませんでした。この URL を送ってください: ${URL_}`,
    });
    await expect(shareInvite(URL_, {})).resolves.toMatchObject({ ok: false });
  });
});
