import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SKIN_IDS } from "./load-skin";
import { parseSkin, SLOT_KEYS, SOUND_KEYS } from "./skin";

const skinsDir = path.resolve(import.meta.dirname, "../../../public/skins");
const ORIGIN = "https://example.com";

const load = (id: string) =>
  parseSkin(
    JSON.parse(readFileSync(path.join(skinsDir, id, "manifest.json"), "utf8")),
    `${ORIGIN}/skins/${id}/manifest.json`
  );

/** 絵の URL を public/ の中のファイルに戻す */
const fileOf = (url: string) => path.join(skinsDir, "..", new URL(url).pathname);

describe.each(SKIN_IDS)("同梱のスキン %s", (id) => {
  it("マニフェストどおりに読み込める", () => {
    expect(load(id).id).toBe(id);
  });

  it("カードと数字・ブルの印は、デザインした絵を使う", () => {
    const { slots } = load(id);

    for (const key of SLOT_KEYS) {
      expect(slots[key], key).toHaveProperty("image");
    }
  });

  it("マニフェストに書いた絵のファイルがある", () => {
    const { slots } = load(id);

    for (const key of SLOT_KEYS) {
      const visual = slots[key];
      if ("image" in visual) expect(existsSync(fileOf(visual.image)), key).toBe(true);
    }
  });
});

describe.each(SKIN_IDS)("同梱のスキン %s の音", (id) => {
  it("当たり・アワード・手番が回るときは振動する", () => {
    const { vibrations } = load(id);

    for (const event of ["hit", "award", "turn"] as const) {
      expect(vibrations[event], event).toBeDefined();
    }
  });

  it("効果音と BGM のファイルがある", () => {
    const { sounds } = load(id).assets;

    for (const key of SOUND_KEYS) {
      expect(existsSync(fileOf(sounds[key])), key).toBe(true);
    }
  });
});

describe("スキンの差し替え", () => {
  it("night は standard と数字・ブルの絵柄から違う（パーツは同じ差し込み口を読むだけ）", () => {
    const standard = load("standard").slots;
    const night = load("night").slots;

    for (const key of SLOT_KEYS) {
      expect(night[key], key).not.toEqual(standard[key]);
    }
  });
});
