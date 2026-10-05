import { describe, expect, it } from "vitest";
import { createGame, currentThrower, throwCards, type Card } from "./game.js";
import { emptyMarks } from "./marks.js";
import { createRng } from "./rng.js";
import { rulesFor } from "./rules.js";
import { chooseAims, CPU_TEMPERATURE, throwValue } from "./cpu.js";
import type { Target } from "./targets.js";
import { viewFor, type GameView } from "./view.js";

let nextId = 0;
const cards = (...targets: Target[]): Card[] => targets.map((target) => ({ id: nextId++, target }));
const many = (target: Target, n: number) => Array<Target>(n).fill(target);

function view(overrides: Partial<GameView>): GameView {
  return {
    rules: rulesFor(4),
    round: 1,
    players: ["me", "b", "c", "d"].map((id) => ({ id, marks: emptyMarks(), handCount: 5 })),
    startPlayer: "me",
    currentThrower: "me",
    deckCount: 21,
    myHand: cards(20, 19, 18, 17, 16),
    throws: [],
    lastRoundThrows: [],
    phase: "throwing",
    winners: null,
    ...overrides,
  };
}

describe("throwValue — 1回の投げの値打ち（9章の重み）", () => {
  it("1マーク = 1 ＋ 0.1 ×（相手それぞれがその数字のオープンまでに要るマークの合計）", () => {
    const me = emptyMarks();
    const opponents = [{ ...emptyMarks(), 20: 3 }, { ...emptyMarks(), 20: 1 }, emptyMarks()];

    // 相手の残り: 0 + 2 + 3 = 5 → 1マーク 1.5
    expect(throwValue({ hits: [20], wildHits: [] }, me, opponents)).toBeCloseTo(1.5);
  });

  it("ワイルドで当たりにした狙いも、その狙いの数字のマークとして数える", () => {
    const opponents = [emptyMarks(), emptyMarks(), emptyMarks()];

    expect(
      throwValue({ hits: [], wildHits: [{ aim: 16, wild: 19 }] }, emptyMarks(), opponents)
    ).toBeCloseTo(1.9);
  });

  it("オープンまでに要る分を超えたマークは数えない", () => {
    const me = { ...emptyMarks(), 18: 2 };
    const opponents = [
      { ...emptyMarks(), 18: 3 },
      { ...emptyMarks(), 18: 3 },
      { ...emptyMarks(), 18: 3 },
    ];

    expect(throwValue({ hits: [18, 18], wildHits: [] }, me, opponents)).toBeCloseTo(1);
  });
});

describe("chooseAims — CPU の狙いの選び方（解釈メモ14）", () => {
  it("手札から狙いの枚数だけ、違うカードを選ぶ", () => {
    const v = view({});

    const aims = chooseAims(v, createRng(1));

    expect(aims).toHaveLength(3);
    expect(new Set(aims).size).toBe(3);
    for (const id of aims) expect(v.myHand!.some((c) => c.id === id)).toBe(true);
  });

  it("揺らぎなし（温度 0）なら、見えている情報から一番当たりそうな数字を狙う（公開された札と自分の手札を候補から除く）", () => {
    // 41枚のうち、手札（19,19,15,15,16）とこのラウンドに公開された札を除くと、残りは 19×4 と 18×1。
    // めくる5枚は必ずこの5枚なので、19 を2枚出すのが一番当たる
    const hand = cards(19, 15, 19, 15, 16);
    const publicCards = cards(
      ...many(15, 4),
      ...many(16, 5),
      ...many(17, 6),
      ...many(18, 5),
      ...many(20, 6),
      ...many("bull", 5)
    );
    const v = view({
      myHand: hand,
      throws: [
        {
          player: "d",
          aims: publicCards.slice(0, 3),
          flips: publicCards.slice(3),
          result: { hits: [], wildHits: [] },
        },
      ],
    });

    const aims = chooseAims(v, createRng(7), { temperature: 0 });

    expect(aims).toEqual(expect.arrayContaining([hand[0]!.id, hand[2]!.id]));
  });

  it("いつも最善ではなく揺らぐ：似た値打ちの手なら、乱数によって違う手を選ぶ", () => {
    const v = view({});
    const chosen = new Set<string>();

    for (let seed = 0; seed < 50; seed++) {
      chosen.add([...chooseAims(v, createRng(seed))].sort().join(","));
    }

    expect(CPU_TEMPERATURE).toBeGreaterThan(0);
    expect(chosen.size).toBeGreaterThan(1);
  });

  it("値打ちが大きく違えば、ほとんどの場合良い方を選ぶ", () => {
    const hand = cards(19, 15, 19, 15, 16);
    const publicCards = cards(
      ...many(15, 4),
      ...many(16, 5),
      ...many(17, 6),
      ...many(18, 5),
      ...many(20, 6),
      ...many("bull", 5)
    );
    const v = view({
      myHand: hand,
      throws: [{ player: "d", aims: [], flips: publicCards, result: { hits: [], wildHits: [] } }],
    });

    let best = 0;
    for (let seed = 0; seed < 200; seed++) {
      const aims = chooseAims(v, createRng(seed));
      if (aims.includes(hand[0]!.id) && aims.includes(hand[2]!.id)) best++;
    }

    expect(best).toBeGreaterThan(180);
  });

  it("候補がめくる枚数より少なくても選べる", () => {
    const publicCards = cards(
      ...many(15, 6),
      ...many(16, 6),
      ...many(17, 6),
      ...many(18, 5),
      ...many(20, 6),
      ...many("bull", 5)
    );
    const v = view({
      myHand: cards(19, 19, 19, 19, 18),
      throws: [{ player: "d", aims: [], flips: publicCards, result: { hits: [], wildHits: [] } }],
    });

    expect(chooseAims(v, createRng(3))).toHaveLength(3);
  });

  it("手札を見られない（観戦者の）状態では選べない", () => {
    expect(() => chooseAims(view({ myHand: null }), createRng(1))).toThrow();
  });

  it("CPU 4人で最後まで遊べる（毎回ルールどおりの投げになる）", () => {
    for (const seed of [1, 2, 3]) {
      const rng = createRng(seed);
      let state = createGame(["a", "b", "c", "d"], rng);
      for (let turn = 0; turn < 400 && state.phase === "throwing"; turn++) {
        const player = currentThrower(state);
        state = throwCards(state, player, chooseAims(viewFor(state, player), rng), rng);
      }

      expect(state.phase).toBe("finished");
    }
  });
});
