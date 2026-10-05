import { describe, expect, it } from "vitest";
import type { ThrowRecord } from "@three-marks/engine";
import {
  classifyGesture,
  latestThrowOf,
  peelProgress,
  REVEAL_AT,
  slotFaces,
  slotOrder,
  type Slot,
} from "./squeeze";

/** 横に並んだ札（中心 x、幅 60・高さ 150） */
const slots: Slot[] = [60, 130, 200, 270, 340].map((x) => ({ x, y: 400, width: 60, height: 150 }));
const at = (x: number, y: number, t: number) => ({ x, y, t });

describe("classifyGesture", () => {
  it("札の上で短く触れて離したら、その札をタップ", () => {
    expect(classifyGesture([at(130, 400, 0), at(132, 401, 120)], slots)).toEqual({
      kind: "tap",
      slot: 1,
    });
  });

  it("札の上から指を動かしたら、その札を絞る（ドラッグ）", () => {
    expect(classifyGesture([at(200, 460, 0), at(202, 420, 200), at(203, 380, 400)], slots)).toEqual(
      {
        kind: "peel",
        slot: 2,
      }
    );
  });

  it("札の列を横に大きく払ったら（札2枚分以上・ほぼ横向き）、速さに関係なく一気に全部めくる", () => {
    expect(classifyGesture([at(40, 400, 0), at(200, 405, 120), at(350, 410, 220)], slots)).toEqual({
      kind: "sweep",
    });
    expect(classifyGesture([at(20, 600, 0), at(370, 610, 1500)], slots)).toEqual({ kind: "sweep" });
    // 斜めに大きく動かしたのは絞り
    expect(classifyGesture([at(60, 400, 0), at(190, 300, 300)], slots)).toEqual({
      kind: "peel",
      slot: 0,
    });
  });

  it("札の外で始まった操作・ゆっくり横に動かしただけは何もしない", () => {
    expect(classifyGesture([at(200, 100, 0), at(200, 90, 100)], slots)).toBeNull();
    expect(classifyGesture([at(60, 400, 0), at(130, 402, 1500)], slots)).toEqual({
      kind: "peel",
      slot: 0,
    });
    expect(classifyGesture([], slots)).toBeNull();
  });
});

describe("peelProgress", () => {
  it("指を動かした距離に応じて 0 から 1 までめくれる（札の高さの 8 割でめくりきる）", () => {
    expect(peelProgress(at(0, 0, 0), at(0, 0, 0), 150)).toBe(0);
    expect(peelProgress(at(0, 150, 0), at(0, 90, 0), 150)).toBeCloseTo(0.5);
    expect(peelProgress(at(0, 0, 0), at(300, 0, 0), 150)).toBe(1);
  });

  it("この先までめくったら、離しても表になる", () => {
    expect(REVEAL_AT).toBeGreaterThan(0);
    expect(REVEAL_AT).toBeLessThan(1);
  });
});

describe("slotFaces", () => {
  const f = (value: 15 | 16 | 17 | 18 | 19 | 20) => ({ kind: "number" as const, value });

  it("めくれた札は、触れた順の置き場所に入る（山札の上から順にめくれる）", () => {
    expect(slotFaces(5, [f(20), f(15)], [3, 0])).toEqual([f(15), null, null, f(20), null]);
  });

  it("触れていない分（一気にめくった・ほかの画面でめくった）は、空いている左から入る", () => {
    expect(slotFaces(5, [f(20), f(15), f(16), f(17), f(18)], [2])).toEqual([
      f(15),
      f(16),
      f(20),
      f(17),
      f(18),
    ]);
  });

  it("触れたがまだ中身が届いていない置き場所は空のまま", () => {
    expect(slotFaces(3, [f(20)], [1, 2])).toEqual([null, f(20), null]);
  });
});

describe("latestThrowOf", () => {
  const record = (player: string, id: number): ThrowRecord => ({
    player,
    aims: [],
    flips: [{ id, target: 20 }],
    result: { hits: [], wildHits: [] },
    awards: [],
  });

  it("その人の一番新しい投げ（ラウンドが変わっていれば前のラウンドから）", () => {
    expect(
      latestThrowOf({ throws: [record("a", 1), record("b", 2)], lastRoundThrows: [] }, "a")
    ).toEqual(record("a", 1));
    expect(
      latestThrowOf({ throws: [record("b", 2)], lastRoundThrows: [record("a", 3)] }, "a")
    ).toEqual(record("a", 3));
    expect(latestThrowOf({ throws: [], lastRoundThrows: [] }, "a")).toBeNull();
  });
});

describe("slotOrder", () => {
  it("i 枚目にめくれた札が入る置き場所（触れた順、残りは空いている左から）", () => {
    expect(slotOrder(5, 5, [3, 0])).toEqual([3, 0, 1, 2, 4]);
    expect(slotOrder(3, 1, [])).toEqual([0]);
  });
});
