import { describe, expect, it } from "vitest";
import {
  createGame,
  currentThrower,
  declareAims,
  GameRuleError,
  revealFlips,
  throwCards,
  type GameState,
} from "./game.js";
import { createRng, type Rng } from "./rng.js";
import { viewFor } from "./view.js";

/** シャッフルで1枚も動かさない（カットは最後の位置を選ぶ）乱数 */
const noShuffle: Rng = { nextInt: (n) => n - 1 };

const ids = (cards: { id: number }[]) => cards.map((c) => c.id);

function start(): GameState {
  return createGame(["d", "a", "b", "c"], noShuffle);
}

/** d が手札の最初の3枚で狙いを出した状態 */
function declared(): GameState {
  const state = start();
  return declareAims(state, "d", ids(state.hands.d!.slice(0, 3)));
}

describe("declareAims — 狙いを出す（まだめくらない）", () => {
  it("狙いが手札から出て、めくり待ちになる。山札もマークもまだ変わらない", () => {
    const state = start();
    const aims = state.hands.d!.slice(0, 3);

    const next = declareAims(state, "d", ids(aims));

    expect(next.pending).toEqual({ player: "d", aims, flips: [] });
    expect(next.hands.d).toEqual(state.hands.d!.slice(3));
    expect(next.deck).toEqual(state.deck);
    expect(next.marks).toEqual(state.marks);
    expect(next.throws).toEqual([]);
  });

  it("手番の人のまま（めくり終わるまで次の人に回らない）", () => {
    expect(currentThrower(declared())).toBe("d");
  });

  it("めくっている途中に、もう一度狙いを出すことはできない", () => {
    const state = declared();

    expect(() => declareAims(state, "d", ids(state.hands.d!.slice(0, 2)))).toThrow(GameRuleError);
  });

  it("手番でない人・終わったゲームでは出せない（throwCards と同じ確かめ）", () => {
    const state = start();
    expect(() => declareAims(state, "a", ids(state.hands.a!.slice(0, 3)))).toThrow(GameRuleError);
    expect(() =>
      declareAims({ ...state, phase: "finished" }, "d", ids(state.hands.d!.slice(0, 3)))
    ).toThrow(GameRuleError);
  });
});

describe("revealFlips — めくる", () => {
  it("1枚めくると、山札の一番上がめくり札になる", () => {
    const state = declared();

    const next = revealFlips(state, "d", 1, noShuffle);

    expect(next.pending!.flips).toEqual([state.deck[0]]);
    expect(next.deck).toEqual(state.deck.slice(1));
    expect(next.marks).toEqual(state.marks);
  });

  it("めくる枚数が揃ったら照合してマークを付け、次の人の手番になる（一度に投げたのと同じ結果）", () => {
    const state = start();
    const aimIds = ids(state.hands.d!.slice(0, 3));
    const atOnce = throwCards(state, "d", aimIds, noShuffle);

    let next = declareAims(state, "d", aimIds);
    for (let i = 0; i < state.rules.flipCount; i++) next = revealFlips(next, "d", 1, noShuffle);

    expect(next).toEqual(atOnce);
    expect(next.pending).toBeNull();
    expect(currentThrower(next)).toBe("a");
  });

  it("残りを一気にめくれる（枚数より多く頼んでも、めくるのは残りの分だけ）", () => {
    const state = start();
    const aimIds = ids(state.hands.d!.slice(0, 3));

    const next = revealFlips(
      revealFlips(declareAims(state, "d", aimIds), "d", 2, noShuffle),
      "d",
      99,
      noShuffle
    );

    expect(next).toEqual(throwCards(state, "d", aimIds, noShuffle));
  });

  it("めくれるのは狙いを出した人だけ。狙いを出す前・0枚以下はめくれない", () => {
    const state = declared();

    expect(() => revealFlips(state, "a", 1, noShuffle)).toThrow(GameRuleError);
    expect(() => revealFlips(state, "d", 0, noShuffle)).toThrow(GameRuleError);
    expect(() => revealFlips(start(), "d", 1, noShuffle)).toThrow(GameRuleError);
  });
});

describe("viewFor — めくっている途中", () => {
  it("狙いと、めくった札だけが全員に見える。まだめくっていない山札は誰にも見えない", () => {
    const state = revealFlips(declared(), "d", 2, noShuffle);

    for (const viewer of ["d", "a", null]) {
      const view = viewFor(state, viewer);

      expect(view.pending).toEqual(state.pending);
      const json = JSON.stringify(view);
      for (const card of state.deck) expect(json).not.toContain(`"id":${card.id},`);
    }
  });

  it("めくっていないときは null", () => {
    expect(viewFor(start(), "a").pending).toBeNull();
  });

  it("乱数で進めても、途中の状態に山札の中身が出ない", () => {
    const rng = createRng(4);
    let state = createGame(["a", "b", "c", "d"], rng);
    for (let turn = 0; turn < 8; turn++) {
      const p = currentThrower(state);
      state = declareAims(state, p, ids(state.hands[p]!.slice(0, 3)));
      for (let i = 0; i < state.rules.flipCount; i++) {
        state = revealFlips(state, p, 1, rng);
        const json = JSON.stringify(viewFor(state, "a"));
        for (const card of state.deck) expect(json).not.toContain(`"id":${card.id},`);
      }
    }
  });
});
