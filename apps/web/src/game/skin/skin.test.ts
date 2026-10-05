import { describe, expect, it } from "vitest";
import { parseSkin, SLOT_KEYS, SOUND_KEYS } from "./skin";
import { buildManifest } from "@/test-utils/skin";

const URL_ = "https://example.com/skins/standard/manifest.json";

describe("parseSkin", () => {
  it("絵の差し込み口は、マニフェストのある場所から URL を解決する", () => {
    const skin = parseSkin(
      buildManifest({
        slots: { "glyph.20": { image: "glyphs/20.svg" } },
        sounds: { "sfx.flip": "sfx/flip.mp3" },
      }),
      URL_
    );

    expect(skin.slots["glyph.20"]).toEqual({
      image: "https://example.com/skins/standard/glyphs/20.svg",
    });
    expect(skin.assets.sounds["sfx.flip"]).toBe("https://example.com/skins/standard/sfx/flip.mp3");
  });

  it("文字や図形も差し込める。色は Phaser が使う数値にする", () => {
    const skin = parseSkin(
      buildManifest({
        colors: { background: "#23272f" },
        slots: {
          "glyph.15": { text: "15", color: "#101218", size: 0.5 },
          "card.face": { rect: "#f4f5f7" },
          "glyph.bull": { rings: ["#2fa36b", "#d93a3a"] },
        },
      }),
      URL_
    );

    expect(skin.colors.background).toBe(0x23272f);
    expect(skin.slots["glyph.15"]).toEqual({ text: "15", color: 0x101218, size: 0.5 });
    expect(skin.slots["card.face"]).toEqual({ rect: 0xf4f5f7 });
    expect(skin.slots["glyph.bull"]).toEqual({ rings: [0x2fa36b, 0xd93a3a] });
  });

  it("効果音は決まった名前をすべて持つ。欠けていたら読み込まない", () => {
    const { sounds, ...manifest } = buildManifest();
    const { "sfx.flip": _missing, ...rest } = sounds;

    expect(SOUND_KEYS).toEqual(["sfx.tap", "sfx.seat", "sfx.flip", "sfx.start"]);
    expect(() => parseSkin({ ...manifest, sounds: rest }, URL_)).toThrow("sfx.flip");
  });

  it("差し込み口が1つでも欠けていたら読み込まない（どれが欠けているかを伝える）", () => {
    const { slots, ...manifest } = buildManifest();
    const { "glyph.bull": _missing, ...rest } = slots;

    expect(() => parseSkin({ ...manifest, slots: rest }, URL_)).toThrow("glyph.bull");
  });

  it("形が違うマニフェストは読み込まない", () => {
    expect(() => parseSkin({ ...buildManifest(), colors: { background: "red" } }, URL_)).toThrow();
  });

  it("差し込み口は、カード・数字とブルの印・入口と待合室の部品", () => {
    expect(SLOT_KEYS).toEqual([
      "card.face",
      "card.back",
      "glyph.15",
      "glyph.16",
      "glyph.17",
      "glyph.18",
      "glyph.19",
      "glyph.20",
      "glyph.bull",
      "logo",
      "button.primary",
      "button.secondary",
      "seat.player",
      "seat.me",
      "seat.cpu",
      "badge.host",
      "toast",
      "icon.up",
      "mark.1",
      "mark.2",
      "mark.3",
      "icon.turn",
      "board.15",
      "board.16",
      "board.17",
      "board.18",
      "board.19",
      "board.20",
      "board.bull",
      "cutin.GAME_SHOT",
      "cutin.THREE_IN_A_BED",
      "cutin.DOUBLE_BULL",
      "cutin.THREE_MARKS",
      "cutin.DOUBLE_OPEN",
      "cutin.OPEN",
    ]);
  });
});
