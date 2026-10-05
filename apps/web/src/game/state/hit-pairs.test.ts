import type { ThrowRecord } from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import { hitPairs } from "./hit-pairs";

const card = (id: number, target: ThrowRecord["aims"][number]["target"]) => ({ id, target });

describe("hitPairs", () => {
  it("当たった札を、同じ数字の狙いにくっつける（めくった順・狙いの左から）", () => {
    const record: ThrowRecord = {
      player: "a",
      aims: [card(1, 18), card(2, 17), card(3, 18)],
      flips: [card(4, 18), card(5, 15), card(6, 17), card(7, 18), card(8, 16)],
      result: { hits: [17, 18, 18], wildHits: [] },
      awards: [],
    };

    expect(hitPairs(record)).toEqual([
      { flip: 0, aim: 0, kind: "hit" },
      { flip: 2, aim: 1, kind: "hit" },
      { flip: 3, aim: 2, kind: "hit" },
    ]);
  });

  it("ワイルドは、充てた狙いにくっつける。通常の命中に使った札は使わない", () => {
    const record: ThrowRecord = {
      player: "a",
      aims: [card(1, 18), card(2, 17), card(3, "bull")],
      flips: [card(4, 20), card(5, 17), card(6, 20), card(7, 15), card(8, 16)],
      result: { hits: [17], wildHits: [{ aim: 18, wild: 20 }] },
      awards: [],
    };

    // 見せる順はめくった順
    expect(hitPairs(record)).toEqual([
      { flip: 0, aim: 0, kind: "wild" },
      { flip: 1, aim: 1, kind: "hit" },
    ]);
  });

  it("当たりが無ければ空", () => {
    const record: ThrowRecord = {
      player: "a",
      aims: [card(1, 18)],
      flips: [card(2, 15)],
      result: { hits: [], wildHits: [] },
      awards: [],
    };
    expect(hitPairs(record)).toEqual([]);
  });
});
