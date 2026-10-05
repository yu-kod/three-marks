import {
  addMarks,
  createGame,
  createRng,
  declareAims,
  revealFlips,
  throwCards,
  viewFor,
  type GameState,
  type GameView,
  type ThrowRecord,
} from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import { replayFrames } from "./replay";

const rng = createRng(3);
const first3 = (state: GameState, p: string) => state.hands[p]!.slice(0, 3).map((c) => c.id);
const start = () => createGame(["a", "b", "c", "d"], createRng(11));
/** 手番の人に投げさせる */
const throwBy = (state: GameState, p: string) => throwCards(state, p, first3(state, p), rng);

describe("replayFrames", () => {
  it("初めて見るときは再生しない（そのまま出す）", () => {
    expect(replayFrames(null, viewFor(start(), "a"))).toEqual([]);
  });

  it("自分が狙いを出したあと、自分と CPU 3人の投げを1枚ずつめくって見せ、ラウンドが変わり、最後は今の状態", () => {
    const declared = declareAims(start(), "a", first3(start(), "a"));
    let next = revealFlips(declared, "a", 5, rng);
    for (const p of ["b", "c", "d"]) next = throwBy(next, p);
    const nextView = viewFor(next, "a");

    const frames = replayFrames(viewFor(declared, "a"), nextView);

    // 4人 ×（5枚めくる + 照合）、全員が投げ終わったのでラウンドの切り替わり。最後のコマは今の状態そのもの
    expect(frames).toHaveLength(4 * 6 + 1);
    expect(frames.at(-1)!.kind).toBe("round");
    expect(frames.at(-1)!.view).toEqual(nextView);
    expect(frames.slice(0, 6).map((f) => f.kind)).toEqual([
      "flip",
      "flip",
      "flip",
      "flip",
      "flip",
      "settle",
    ]);
    expect(frames[2]!.view.pending).toMatchObject({ player: "a" });
    expect(frames[2]!.view.pending!.flips).toHaveLength(3);
  });

  it("照合のコマで、その投げまでのマークが付く（後の人の分はまだ付かない）", () => {
    const state = start();
    const afterA = throwBy(state, "a");
    const afterB = throwBy(afterA, "b");

    const frames = replayFrames(viewFor(state, "c"), viewFor(afterB, "c"));
    const settleA = frames.find((f) => f.kind === "settle")!;

    const a = settleA.view.players.find((p) => p.id === "a")!;
    const b = settleA.view.players.find((p) => p.id === "b")!;
    expect(a.marks).toEqual(afterA.marks.a);
    expect(b.marks).toEqual(state.marks.b);
    expect(settleA.view.throws).toHaveLength(1);
  });

  it("もう見えているめくり札は飛ばす（人が1枚ずつめくった続き）", () => {
    const declared = declareAims(start(), "a", first3(start(), "a"));
    const twoShown = revealFlips(declared, "a", 2, rng);
    const done = revealFlips(twoShown, "a", 3, rng);

    const frames = replayFrames(viewFor(twoShown, "b"), viewFor(done, "b"));

    expect(frames.map((f) => f.kind)).toEqual(["flip", "flip", "flip", "settle"]);
  });

  it("ラウンドが変わったら、前のラウンドの残りを見せてから ROUND の切り替わりを挟む", () => {
    let state = start();
    for (const p of ["a", "b", "c"]) state = throwBy(state, p);
    const beforeLast = state;
    const nextRound = throwBy(state, "d");
    expect(nextRound.round).toBe(2);

    const frames = replayFrames(viewFor(beforeLast, "a"), viewFor(nextRound, "a"));

    expect(frames.map((f) => f.kind)).toEqual([...Array(5).fill("flip"), "settle", "round"]);
    expect(frames.at(-1)).toMatchObject({ kind: "round", banner: "ROUND 2" });
    expect(frames.at(-1)!.view).toEqual(viewFor(nextRound, "a"));
    // 前のラウンドの最後の投げの照合では、まだ前のラウンドの手札とラウンド番号
    expect(frames[5]!.view.round).toBe(1);
    expect(frames[5]!.view.myHand).toEqual(viewFor(beforeLast, "a").myHand);
  });

  it("新しく投げが無ければ再生しない（同じ状態の取り直し）", () => {
    const view = viewFor(start(), "a");
    expect(replayFrames(view, view)).toEqual([]);
  });

  it("マークは前の状態から順に足す（3を超えた分は捨てる）", () => {
    const state = start();
    const full: GameState = {
      ...state,
      marks: { ...state.marks, a: addMarks(state.marks.a!, [20, 20, 20]) },
    };
    const afterA = throwBy(full, "a");

    const frames = replayFrames(viewFor(full, "b"), viewFor(afterA, "b"));

    expect(frames.at(-1)!.view.players[0]!.marks).toEqual(afterA.marks.a);
  });

  it("ワイルドで当たりにした狙いにもマークが付く", () => {
    const prev = viewFor(start(), "b");
    const record: ThrowRecord = {
      player: "a",
      aims: [{ id: 1, target: 18 }],
      flips: [{ id: 2, target: 20 }],
      result: { hits: [], wildHits: [{ aim: 18, wild: 20 }] },
      awards: [],
    };
    const miss: ThrowRecord = { ...record, player: "b", result: { hits: [], wildHits: [] } };
    const next: GameView = { ...prev, throws: [record, miss], currentThrower: "c" };

    // a の照合のコマ（最後のコマではないので、途中のマークが見える）
    const settle = replayFrames(prev, next).find((f) => f.kind === "settle")!;

    expect(settle.view.players[0]!.marks[18]).toBe(1);
  });

  it("ゲームが終わったら、最後の投げを見せてから結果（ラウンドの切り替わりは挟まない）", () => {
    const prev = viewFor(start(), "b");
    const record: ThrowRecord = {
      player: "a",
      aims: [{ id: 1, target: 18 }],
      flips: [{ id: 2, target: 18 }],
      result: { hits: [18], wildHits: [] },
      awards: [],
    };
    const finished: GameView = {
      ...prev,
      phase: "finished",
      winners: ["a"],
      currentThrower: null,
      throws: [],
      lastRoundThrows: [record],
    };

    const frames = replayFrames(prev, finished);

    expect(frames.map((f) => f.kind)).toEqual(["flip", "settle"]);
    expect(frames.at(-1)!.view).toEqual(finished);
  });
});
