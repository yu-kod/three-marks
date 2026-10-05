import { describe, expect, it, vi } from "vitest";
import { createJsonStorage } from "@app/web-core";
import { DEFAULT_SKIN_ID, loadSkin, savedSkinId, saveSkinId } from "./load-skin";
import { buildManifest } from "@/test-utils/skin";

describe("端末に保存したスキンの選択", () => {
  const storage = () => createJsonStorage(() => window.localStorage);

  it("選んだスキンを保存し、次に開いたときもそれを使う", () => {
    saveSkinId("night", storage());

    expect(savedSkinId(storage())).toBe("night");
  });

  it("保存が無い・知らないスキンなら標準", () => {
    expect(savedSkinId(storage())).toBe(DEFAULT_SKIN_ID);

    window.localStorage.setItem("three-marks:skin", JSON.stringify("../../etc"));
    expect(savedSkinId(storage())).toBe(DEFAULT_SKIN_ID);
  });
});

describe("loadSkin", () => {
  it("public/skins/<id>/manifest.json を読んでスキンにする", async () => {
    const fetchFn = vi.fn(async () => Response.json(buildManifest({ id: "night" })));

    const skin = await loadSkin("night", { origin: "https://example.com", fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledWith("https://example.com/skins/night/manifest.json");
    expect(skin.id).toBe("night");
  });

  it("読めなければ失敗する", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 404 }));

    await expect(
      loadSkin("night", { origin: "https://example.com", fetch: fetchFn })
    ).rejects.toThrow("スキン night");
  });
});
