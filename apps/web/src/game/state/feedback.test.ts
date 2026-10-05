import { createJsonStorage } from "@app/web-core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bgmVolume,
  DEFAULT_AUDIO_SETTINGS,
  feedbackFor,
  nextVolume,
  saveAudioSettings,
  savedAudioSettings,
  settleFeedback,
  VOLUME_LABELS,
} from "./feedback";

const storage = () => createJsonStorage(() => window.localStorage);

describe("音と振動の設定", () => {
  beforeEach(() => window.localStorage.clear());

  it("音量は なし・小・中・大 を順に切り替え、大の次はなしに戻る", () => {
    expect(VOLUME_LABELS).toEqual(["なし", "小", "中", "大"]);
    expect(nextVolume(0)).toBe(1);
    expect(nextVolume(3)).toBe(0);
  });

  it("端末に保存し、リロードしても残る。無い・壊れた値なら既定（効果音 中・BGM 小・振動あり）", () => {
    expect(savedAudioSettings(storage())).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(DEFAULT_AUDIO_SETTINGS).toEqual({ sfx: 2, bgm: 1, vibrate: true });

    saveAudioSettings({ sfx: 3, bgm: 0, vibrate: false }, storage());
    expect(savedAudioSettings(storage())).toEqual({ sfx: 3, bgm: 0, vibrate: false });

    storage().set("three-marks:audio", { sfx: 9, bgm: "x", vibrate: 1 });
    expect(savedAudioSettings(storage())).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it("BGM の音量は段階から（なしなら 0）", () => {
    expect(bgmVolume({ ...DEFAULT_AUDIO_SETTINGS, bgm: 0 })).toBe(0);
    expect(bgmVolume({ ...DEFAULT_AUDIO_SETTINGS, bgm: 3 })).toBeGreaterThan(
      bgmVolume({ ...DEFAULT_AUDIO_SETTINGS, bgm: 1 })
    );
  });
});

describe("feedbackFor", () => {
  const patterns = { hit: [30], award: [40, 60, 80] };

  it("できごとごとに鳴らす効果音を決める", () => {
    const sound = (event: Parameters<typeof feedbackFor>[0]) =>
      feedbackFor(event, DEFAULT_AUDIO_SETTINGS, patterns).sound;

    expect(sound("tap")).toBe("sfx.tap");
    expect(sound("select")).toBe("sfx.select");
    expect(sound("throw")).toBe("sfx.throw");
    expect(sound("flip")).toBe("sfx.flip");
    expect(sound("hit")).toBe("sfx.hit");
    expect(sound("miss")).toBe("sfx.miss");
    expect(sound("open")).toBe("sfx.open");
    expect(sound("award")).toBe("sfx.award");
    expect(sound("turn")).toBe("sfx.turn");
    expect(sound("start")).toBe("sfx.start");
    expect(sound("seat")).toBe("sfx.seat");
  });

  it("音量は効果音の段階から。なしなら鳴らさない", () => {
    const mid = feedbackFor("hit", DEFAULT_AUDIO_SETTINGS, patterns);
    const loud = feedbackFor("hit", { ...DEFAULT_AUDIO_SETTINGS, sfx: 3 }, patterns);

    expect(loud.volume).toBeGreaterThan(mid.volume);
    expect(feedbackFor("hit", { ...DEFAULT_AUDIO_SETTINGS, sfx: 0 }, patterns).sound).toBeNull();
  });

  it("振動はスキンの決めた形で。決めていないできごと・振動オフなら振動しない", () => {
    expect(feedbackFor("award", DEFAULT_AUDIO_SETTINGS, patterns).vibrate).toEqual([40, 60, 80]);
    expect(feedbackFor("tap", DEFAULT_AUDIO_SETTINGS, patterns).vibrate).toBeNull();
    expect(
      feedbackFor("hit", { ...DEFAULT_AUDIO_SETTINGS, vibrate: false }, patterns).vibrate
    ).toBeNull();
  });
});

describe("settleFeedback", () => {
  it("照合した投げに当たりがあれば当たり、なければ外れの音", () => {
    expect(settleFeedback(2)).toBe("hit");
    expect(settleFeedback(0)).toBe("miss");
  });
});
