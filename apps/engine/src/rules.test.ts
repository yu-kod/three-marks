import { describe, expect, it } from "vitest";
import { deckSize, rulesFor } from "./rules.js";

describe("rulesFor（7章 人数別の設定）", () => {
  it.each([
    [4, 5],
    [3, 5],
    [2, 8],
  ])("%i 人: 手札5枚・狙い3枚・めくり %i 枚", (players, flips) => {
    expect(rulesFor(players)).toMatchObject({ handSize: 5, aimCount: 3, flipCount: flips });
  });

  it("デッキは 15〜20 を各6枚、Bull を5枚の計41枚（1章）", () => {
    const rules = rulesFor(4);

    expect(rules.deck).toEqual({ 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6, bull: 5 });
    expect(deckSize(rules)).toBe(41);
  });

  it.each([1, 5])("%i 人では遊べない", (players) => {
    expect(() => rulesFor(players)).toThrow("2〜4人");
  });

  it.each([2, 3, 4])("%i 人でも1ラウンドで山札が尽きない（解釈メモ7）", (players) => {
    const rules = rulesFor(players);

    expect(players * (rules.handSize + rules.flipCount)).toBeLessThanOrEqual(deckSize(rules));
  });
});
