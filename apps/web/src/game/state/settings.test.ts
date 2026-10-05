import { describe, expect, it } from "vitest";
import { cycleSetting, settingsRows } from "./settings";
import { DEFAULT_AUDIO_SETTINGS } from "./feedback";

const current = { effects: "normal" as const, audio: DEFAULT_AUDIO_SETTINGS };

describe("設定の画面", () => {
  it("演出・効果音・BGM・振動を、今の値と並べる", () => {
    expect(settingsRows(current)).toEqual([
      { key: "effects", label: "演出", value: "標準" },
      { key: "sfx", label: "効果音", value: "中" },
      { key: "bgm", label: "BGM", value: "小" },
      { key: "vibrate", label: "振動", value: "あり" },
    ]);
  });

  it("押すたびに次の値へ（ほかの値は変えない）", () => {
    expect(cycleSetting(current, "effects")).toEqual({ ...current, effects: "weak" });
    expect(cycleSetting(current, "sfx").audio).toEqual({ ...DEFAULT_AUDIO_SETTINGS, sfx: 3 });
    expect(cycleSetting(current, "bgm").audio).toEqual({ ...DEFAULT_AUDIO_SETTINGS, bgm: 2 });
    const off = cycleSetting(current, "vibrate");
    expect(off.audio.vibrate).toBe(false);
    expect(settingsRows(off)[3]!.value).toBe("なし");
  });
});
