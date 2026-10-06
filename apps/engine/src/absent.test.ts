import { describe, expect, it } from "vitest";
import { playForAbsent } from "./absent.js";
import { createGame, currentThrower, declareAims, revealFlips, type GameState } from "./game.js";
import type { Rng } from "./rng.js";

/** シャッフルで1枚も動かさない（カットは最後の位置を選ぶ）乱数 */
const noShuffle: Rng = { nextInt: (n) => n - 1 };

const start = (): GameState => createGame(["d", "a", "b", "c"], noShuffle);

describe("playForAbsent — いなくなった人の手番を代わりに進める（解釈メモ17）", () => {
  it("狙いを出す前なら、CPU と同じ選び方で狙いを出して全部めくり、代わりに進めた印を付ける", () => {
    const state = start();

    const next = playForAbsent(state, noShuffle);

    expect(next.pending).toBeNull();
    expect(next.throws).toHaveLength(1);
    const record = next.throws[0]!;
    expect(record.player).toBe("d");
    expect(record.auto).toBe(true);
    expect(record.aims).toHaveLength(state.rules.aimCount);
    expect(record.flips).toHaveLength(state.rules.flipCount);
    expect(currentThrower(next)).toBe("a");
  });

  it("めくっている途中なら、狙いはそのままで残りを全部めくる", () => {
    const state = start();
    const aims = state.hands.d!.slice(0, 3).map((c) => c.id);
    const halfway = revealFlips(declareAims(state, "d", aims), "d", 2, noShuffle);

    const next = playForAbsent(halfway, noShuffle);

    const record = next.throws[0]!;
    expect(record.aims).toEqual(halfway.pending!.aims);
    expect(record.flips.slice(0, 2)).toEqual(halfway.pending!.flips);
    expect(record.flips).toHaveLength(state.rules.flipCount);
    expect(record.auto).toBe(true);
  });

  it("自分で投げ終えた投げには印を付けない", () => {
    const state = start();
    const aims = state.hands.d!.slice(0, 3).map((c) => c.id);
    const next = revealFlips(declareAims(state, "d", aims), "d", 5, noShuffle);

    expect(next.throws[0]!.auto).toBeUndefined();
  });
});
