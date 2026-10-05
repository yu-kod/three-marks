import {
  createGame,
  createRng,
  declareAims,
  revealFlips,
  viewFor,
  type GameState,
  type ThrowRecord,
} from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import { flipOutcomes, gameModel, toggleAim } from "./game-model";
import { buildRoom } from "@/test-utils/table";

const room = buildRoom({
  status: "playing",
  members: [
    { id: "a", name: "あなた", cpu: false },
    { id: "b", name: "ペンギン", cpu: false },
    { id: "c", name: "CPU 1", cpu: true },
    { id: "d", name: "CPU 2", cpu: true },
  ],
});

const newGame = () => createGame(["a", "b", "c", "d"], createRng(7));
const aimIds = (state: GameState, player: string) =>
  state.hands[player]!.slice(0, 3).map((c) => c.id);

describe("gameModel", () => {
  it("席順にプレイヤーを並べ、名前・オープン数・手番・自分かを出す", () => {
    const model = gameModel(room, viewFor(newGame(), "b"), "b");

    expect(model.players).toEqual([
      { id: "a", name: "あなた", open: 0, turn: true, me: false, winner: false },
      { id: "b", name: "ペンギン", open: 0, turn: false, me: true, winner: false },
      { id: "c", name: "CPU 1", open: 0, turn: false, me: false, winner: false },
      { id: "d", name: "CPU 2", open: 0, turn: false, me: false, winner: false },
    ]);
    expect(model.round).toBe(1);
  });

  it("得点表は 20 から 15、最後に BULL。席順に全員のマークを並べ、全員がオープンした数字は死に番", () => {
    const state = newGame();
    const opened = { 15: 3, 16: 0, 17: 0, 18: 0, 19: 0, 20: 2, bull: 1 };
    const marked: GameState = {
      ...state,
      marks: { a: opened, b: { ...opened, 20: 3 }, c: opened, d: opened },
    };

    const { rows } = gameModel(room, viewFor(marked, "a"), "a");

    expect(rows.map((r) => r.target)).toEqual([20, 19, 18, 17, 16, 15, "bull"]);
    expect(rows[0]).toEqual({ target: 20, marks: [2, 3, 2, 2], dead: false });
    expect(rows[5]).toEqual({ target: 15, marks: [3, 3, 3, 3], dead: true });
  });

  it("自分の手番なら、手札から狙いを選ぶ。狙いを出したら、めくる番", () => {
    const state = newGame();
    const select = gameModel(room, viewFor(state, "a"), "a");
    const declared = declareAims(state, "a", aimIds(state, "a"));
    const flip = gameModel(room, viewFor(declared, "a"), "a");

    expect(select.myTurn).toBe("select");
    expect(select.hand).toHaveLength(5);
    expect(select.aimCount).toBe(3);
    expect(flip.myTurn).toBe("flip");
    expect(flip.hand).toHaveLength(2);
  });

  it("他の人の手番や観戦者は選べない。観戦者には手札が無い", () => {
    expect(gameModel(room, viewFor(newGame(), "b"), "b").myTurn).toBeNull();
    expect(gameModel(room, viewFor(newGame(), null), null)).toMatchObject({
      myTurn: null,
      hand: null,
    });
  });

  it("めくっている途中の投げは、誰の投げか・狙い・めくった札・残りの枚数を出す", () => {
    const state = newGame();
    const declared = declareAims(state, "a", aimIds(state, "a"));
    const twoFlipped = revealFlips(declared, "a", 2, createRng(1));

    const { current } = gameModel(room, viewFor(twoFlipped, "b"), "b");

    expect(current).toMatchObject({ name: "あなた", flipsLeft: 3 });
    expect(current!.aims).toHaveLength(3);
    expect(current!.flips).toHaveLength(2);
  });

  it("直前の投げは、このラウンドの最後の投げ。ラウンドの最初は前のラウンドの最後の投げ", () => {
    const state = newGame();
    const thrown = revealFlips(declareAims(state, "a", aimIds(state, "a")), "a", 5, createRng(1));

    expect(gameModel(room, viewFor(state, "a"), "a").lastThrow).toBeNull();
    expect(gameModel(room, viewFor(thrown, "a"), "a").lastThrow).toMatchObject({ name: "あなた" });
    const nextRound: GameState = { ...state, throws: [], lastRoundThrows: thrown.throws };
    expect(gameModel(room, viewFor(nextRound, "a"), "a").lastThrow).toMatchObject({
      name: "あなた",
    });
  });

  it("山札の枚数", () => {
    expect(gameModel(room, viewFor(newGame(), "a"), "a").deckCount).toBe(21);
  });

  it("終わったら勝者を出す（自分が勝ったか）", () => {
    const finished: GameState = { ...newGame(), phase: "finished", winners: ["b"] };

    expect(gameModel(room, viewFor(finished, "b"), "b")).toMatchObject({
      myTurn: null,
      result: { winners: ["ペンギン"], iWon: true },
    });
    expect(gameModel(room, viewFor(finished, "a"), "a").result).toEqual({
      winners: ["ペンギン"],
      iWon: false,
    });
    expect(gameModel(room, viewFor(finished, "a"), "a").players[1]!.winner).toBe(true);
  });
});

describe("flipOutcomes", () => {
  const card = (id: number, target: ThrowRecord["aims"][number]["target"]) => ({ id, target });

  it("めくり札ごとに、命中・ワイルド・外れを出す（同じ数字は命中を先に数える）", () => {
    const record: ThrowRecord = {
      player: "a",
      aims: [card(1, 18), card(2, 17), card(3, "bull")],
      flips: [card(4, 20), card(5, 17), card(6, 20), card(7, 15), card(8, 16)],
      result: { hits: [17], wildHits: [{ aim: 18, wild: 20 }] },
      awards: [],
    };

    expect(flipOutcomes(record)).toEqual(["wild", "hit", "miss", "miss", "miss"]);
  });
});

describe("toggleAim", () => {
  it("選ぶ・外す。選べるのは狙いの枚数まで", () => {
    expect(toggleAim([], 5, 3)).toEqual([5]);
    expect(toggleAim([5, 6], 5, 3)).toEqual([6]);
    expect(toggleAim([1, 2, 3], 4, 3)).toEqual([1, 2, 3]);
  });
});
