import { describe, expect, it } from "vitest";
import { awardsFor } from "./awards.js";
import { createGame, declareAims, revealFlips, type GameState } from "./game.js";
import { emptyMarks, type Marks } from "./marks.js";
import type { Rng } from "./rng.js";
import type { ThrowResult } from "./throw.js";

const marks = (m: Partial<Marks> = {}): Marks => ({ ...emptyMarks(), ...m });
const result = (hits: ThrowResult["hits"], wildAims: ThrowResult["hits"] = []): ThrowResult => ({
  hits,
  wildHits: wildAims.map((aim) => ({ aim, wild: "bull" as const })),
});
const kinds = (awards: ReturnType<typeof awardsFor>) => awards.map((a) => a.kind);

describe("awardsFor — 投げの結果のアワード（#31）", () => {
  it("何も起きなければアワードは無い", () => {
    expect(awardsFor(result([]), marks())).toEqual([]);
    expect(awardsFor(result([18, 17]), marks())).toEqual([]);
  });

  it("OPEN：数字をオープンした（数字ごと）", () => {
    expect(awardsFor(result([18]), marks({ 18: 2 }))).toEqual([{ kind: "OPEN", target: 18 }]);
  });

  it("THREE_MARKS：1回で3マーク（ワイルドで当たりにした分も数える）", () => {
    expect(kinds(awardsFor(result([20, 18], [17]), marks()))).toEqual(["THREE_MARKS"]);
  });

  it("オープン済みで捨てられたマークは数えない（3マークにならない）", () => {
    // 18 は 2マークから2つ当たって 1つは捨てる → 実際に付くのは 18 に1・17 に1 の2マーク
    expect(kinds(awardsFor(result([18, 18, 17]), marks({ 18: 2 })))).toEqual(["OPEN"]);
  });

  it("DOUBLE_OPEN：1回で2つオープン（それぞれの OPEN も付く）", () => {
    expect(awardsFor(result([20, 19]), marks({ 20: 2, 19: 2 }))).toEqual([
      { kind: "DOUBLE_OPEN" },
      { kind: "OPEN", target: 20 },
      { kind: "OPEN", target: 19 },
    ]);
  });

  it("3 IN A BED：同じ数字3枚で3マーク（その場でオープン）。THREE_MARKS より上", () => {
    expect(kinds(awardsFor(result([16, 16, 16]), marks()))).toEqual([
      "THREE_IN_A_BED",
      "THREE_MARKS",
      "OPEN",
    ]);
  });

  it("DOUBLE_BULL：BULL で2マーク", () => {
    expect(kinds(awardsFor(result(["bull", "bull"]), marks()))).toEqual(["DOUBLE_BULL"]);
  });

  it("GAME_SHOT：すべてオープンした（上がり）。一番上に来る", () => {
    const before = marks({ 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, bull: 2 });

    expect(kinds(awardsFor(result(["bull"]), before))).toEqual(["GAME_SHOT", "OPEN"]);
  });

  it("めくり終わって照合した投げの記録にアワードが付く", () => {
    const noShuffle: Rng = { nextInt: (n) => n - 1 };
    let state: GameState = createGame(["d", "a", "b", "c"], noShuffle);
    const aims = state.hands.d!.slice(0, 3).map((c) => c.id);
    state = revealFlips(declareAims(state, "d", aims), "d", 5, noShuffle);

    const record = state.throws[0]!;
    expect(record.awards).toEqual(awardsFor(record.result, marks()));
  });
});
