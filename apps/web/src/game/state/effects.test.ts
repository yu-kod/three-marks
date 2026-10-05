import { describe, expect, it } from "vitest";
import { createJsonStorage } from "@app/web-core";
import {
  cutInStyle,
  EFFECT_LEVELS,
  effectPlan,
  nextEffectLevel,
  playbackSpeed,
  saveEffectLevel,
  savedEffectLevel,
} from "./effects";
import type { CutIn } from "./cut-in";

const cut = (over: Partial<CutIn> = {}): CutIn => ({
  kind: "THREE_MARKS",
  tier: 3,
  who: "あなた",
  opened: [],
  mine: true,
  ...over,
});

describe("演出の強さ", () => {
  it("強・標準・弱・なしの順に切り替わり、なしの次は強に戻る", () => {
    expect(EFFECT_LEVELS).toEqual(["strong", "normal", "weak", "off"]);
    expect(nextEffectLevel("strong")).toBe("normal");
    expect(nextEffectLevel("weak")).toBe("off");
    expect(nextEffectLevel("off")).toBe("strong");
  });

  it("端末に保存する。無い・知らない値なら標準", () => {
    window.localStorage.clear();
    const storage = createJsonStorage(() => window.localStorage);
    expect(savedEffectLevel(storage)).toBe("normal");
    saveEffectLevel("weak", storage);
    expect(savedEffectLevel(storage)).toBe("weak");
    storage.set("three-marks:effects", "loud");
    expect(savedEffectLevel(storage)).toBe("normal");
  });

  it("弱いほど再生が速く、揺れ・光を出さない", () => {
    expect(effectPlan("strong")).toEqual({ speed: 1, shake: true, flash: true });
    expect(effectPlan("normal")).toEqual({ speed: 1, shake: true, flash: true });
    expect(effectPlan("weak")).toEqual({ speed: 1.5, shake: false, flash: false });
    expect(effectPlan("off")).toEqual({ speed: 3, shake: false, flash: false });
  });
});

describe("cutInStyle", () => {
  it("標準：自分の投げは格が高いほど長く・暗く、3 MARKS から揺れて紙吹雪", () => {
    const low = cutInStyle("normal", cut({ kind: "OPEN", tier: 1 }), false)!;
    const high = cutInStyle("normal", cut({ kind: "GAME_SHOT", tier: 6 }), false)!;

    expect(high.holdRate).toBeGreaterThan(low.holdRate);
    expect(high.dim).toBeGreaterThan(low.dim);
    expect(low).toMatchObject({ scale: 1, flash: false, shake: 0, confetti: 0 });
    expect(cutInStyle("normal", cut({ kind: "DOUBLE_OPEN", tier: 2 }), false)!.flash).toBe(true);
    expect(high.shake).toBeGreaterThan(0);
    expect(high.confetti).toBe(12 + 6 * 8);
  });

  it("ほかの人の投げは小さく短く、揺れも光も紙吹雪も無し", () => {
    const style = cutInStyle("normal", cut({ kind: "GAME_SHOT", tier: 6, mine: false }), false)!;

    expect(style.scale).toBeLessThan(1);
    expect(style.holdRate).toBeLessThan(cutInStyle("normal", cut({ tier: 6 }), false)!.holdRate);
    expect(style).toMatchObject({ flash: false, shake: 0, confetti: 0 });
  });

  it("同じ演出が続くときは短く、紙吹雪も減らす", () => {
    const first = cutInStyle("normal", cut(), false)!;
    const again = cutInStyle("normal", cut(), true)!;

    expect(again.holdRate).toBeCloseTo(first.holdRate * 0.5);
    expect(again.confetti).toBe(Math.round(first.confetti / 2));
  });

  it("強：長く、紙吹雪も多い", () => {
    const normal = cutInStyle("normal", cut(), false)!;
    const strong = cutInStyle("strong", cut(), false)!;

    expect(strong.holdRate).toBeGreaterThan(normal.holdRate);
    expect(strong.confetti).toBeGreaterThan(normal.confetti);
    expect(strong.shake).toBeGreaterThan(normal.shake);
  });

  it("弱：自分の投げだけ短く出す（揺れ・光・紙吹雪なし）。ほかの人の投げは出さない", () => {
    const mine = cutInStyle("weak", cut({ tier: 6 }), false)!;

    expect(mine.holdRate).toBeLessThan(cutInStyle("normal", cut({ tier: 6 }), false)!.holdRate);
    expect(mine).toMatchObject({ flash: false, shake: 0, confetti: 0 });
    expect(cutInStyle("weak", cut({ mine: false }), false)).toBeNull();
  });

  it("なし：カットインを出さない", () => {
    expect(cutInStyle("off", cut({ tier: 6 }), false)).toBeNull();
  });
});

describe("playbackSpeed", () => {
  it("演出中にタップすると早送り（強さの速さの4倍）", () => {
    expect(playbackSpeed("normal", false)).toBe(1);
    expect(playbackSpeed("normal", true)).toBe(4);
    expect(playbackSpeed("weak", true)).toBe(6);
  });
});
