import { describe, expect, it } from "vitest";
import {
  createGame,
  currentThrower,
  GameRuleError,
  throwCards,
  type Card,
  type GameState,
} from "./game.js";
import { emptyMarks, type Marks } from "./marks.js";
import { createRng, shuffle, type Rng } from "./rng.js";
import type { Target } from "./targets.js";

/** シャッフルで1枚も動かさない（カットは最後の位置を選ぶ）乱数 */
const noShuffle: Rng = { nextInt: (n) => n - 1 };

const ids = (cards: { id: number }[]) => cards.map((c) => c.id);

describe("createGame（3章 準備・4.1 配る）", () => {
  it("41枚をシャッフルし、スタートプレイヤーから時計回りに1枚ずつ5枚配る", () => {
    const game = createGame(["d", "a", "b", "c"], noShuffle);

    // 席順は d, a, b, c で、1番目の d がスタート。d → a → b → c の順に1枚ずつ。
    // noShuffle では id の振り直しも並べ替えないので、id は 1000 + 山札の何枚目か
    expect(game.startIndex).toBe(0);
    expect(ids(game.hands.d!)).toEqual([1000, 1004, 1008, 1012, 1016]);
    expect(ids(game.hands.a!)).toEqual([1001, 1005, 1009, 1013, 1017]);
    expect(ids(game.hands.c!)).toEqual([1003, 1007, 1011, 1015, 1019]);
    expect(ids(game.deck)).toEqual(Array.from({ length: 21 }, (_, i) => 1020 + i));
  });

  it("デッキは数字ごとに 15〜20 が6枚、Bull が5枚", () => {
    const game = createGame(["a", "b"], noShuffle);
    const all = [...game.deck, ...game.hands.a!, ...game.hands.b!];

    const counts: Record<string, number> = {};
    for (const card of all) counts[card.target] = (counts[card.target] ?? 0) + 1;
    expect(counts).toEqual({
      15: 6,
      16: 6,
      17: 6,
      18: 6,
      19: 6,
      20: 6,
      bull: 5,
    });
  });

  it("シャッフルされ、同じシードなら同じゲームになる", () => {
    const a = createGame(["a", "b", "c"], createRng(5));
    const b = createGame(["a", "b", "c"], createRng(5));

    expect(a).toEqual(b);
    expect(ids(a.deck)).not.toEqual([...ids(a.deck)].sort((x, y) => x - y));
  });

  it("席順の1番目が最初のスタートプレイヤー（解釈メモ11。乱数で選ばない）", () => {
    for (const seed of [1, 2, 3]) {
      const game = createGame(["a", "b", "c"], createRng(seed));

      expect(game.startIndex).toBe(0);
      expect(currentThrower(game)).toBe("a");
    }
  });

  it("全員マーク 0、1ラウンド目、スタートプレイヤーの手番から始まる", () => {
    const game = createGame(["d", "a", "b", "c"], noShuffle);

    expect(game).toMatchObject({
      round: 1,
      throws: [],
      lastRoundThrows: [],
      phase: "throwing",
      winners: null,
    });
    expect(game.marks).toEqual({
      a: emptyMarks(),
      b: emptyMarks(),
      c: emptyMarks(),
      d: emptyMarks(),
    });
    expect(currentThrower(game)).toBe("d");
  });

  it("2人戦は1回に8枚めくる設定になる（7章）", () => {
    expect(createGame(["a", "b"], noShuffle).rules.flipCount).toBe(8);
  });

  it.each([[["a"]], [["a", "b", "c", "d", "e"]]])("%j では始められない", (players) => {
    expect(() => createGame(players, noShuffle)).toThrow(GameRuleError);
  });

  it("同じプレイヤーが2回いたら始められない", () => {
    expect(() => createGame(["a", "a"], noShuffle)).toThrow(GameRuleError);
  });
});

/** id を振ったカードを作る（id は 1000 から） */
let nextId = 1000;
function cards(...targets: Target[]): Card[] {
  return targets.map((target) => ({ id: nextId++, target }));
}

/** d がスタートの4人戦を、手札・山札・マークを差し替えて作る */
function setupTable(overrides: Partial<GameState> = {}): GameState {
  return { ...createGame(["d", "a", "b", "c"], noShuffle), ...overrides };
}

describe("throwCards（4.2 投げる）", () => {
  it("手札から狙い3枚を出し、山札の上から5枚めくって照合し、マークを付ける", () => {
    const hand = cards(18, 17, "bull", 15, 16);
    const deck = cards(20, 20, 17, 15, 16, 19, 19);
    const state = setupTable({
      hands: { ...setupTable().hands, d: hand },
      deck,
      marks: { ...setupTable().marks, d: { ...emptyMarks(), 20: 3 } },
    });

    const next = throwCards(state, "d", [hand[0]!.id, hand[1]!.id, hand[2]!.id], noShuffle);

    // spec 4.3 の例: 17 が命中、20 のワイルドで 18
    expect(next.marks.d).toEqual({ ...emptyMarks(), 20: 3, 17: 1, 18: 1 });
    expect(next.throws).toEqual([
      {
        player: "d",
        aims: hand.slice(0, 3),
        flips: deck.slice(0, 5),
        result: { hits: [17], wildHits: [{ aim: 18, wild: 20 }] },
      },
    ]);
    expect(next.hands.d).toEqual(hand.slice(3));
    expect(next.deck).toEqual(deck.slice(5));
  });

  it("狙いは選んだ順のまま記録する（出た順のまま並べる。4.2-4）", () => {
    const hand = cards(15, 16, 17, 18, 19);
    const state = setupTable({ hands: { ...setupTable().hands, d: hand } });

    const next = throwCards(state, "d", [hand[4]!.id, hand[0]!.id, hand[2]!.id], noShuffle);

    expect(next.throws[0]!.aims.map((c) => c.target)).toEqual([19, 15, 17]);
  });

  it("ワイルドと死に番は投げる前の状態で判定する（解釈メモ3）", () => {
    // d は 20 に2マーク。この投げで 20 が開いても、めくった 20 はこの投げのワイルドにならない
    const hand = cards(20, 20, 18, 15, 15);
    const deck = cards(20, 20, 20, 16, 16);
    const state = setupTable({
      hands: { ...setupTable().hands, d: hand },
      deck,
      marks: { ...setupTable().marks, d: { ...emptyMarks(), 20: 2 } },
    });

    const next = throwCards(state, "d", [hand[0]!.id, hand[1]!.id, hand[2]!.id], noShuffle);

    expect(next.throws[0]!.result).toEqual({ hits: [20, 20], wildHits: [] });
    expect(next.marks.d![20]).toBe(3);
  });

  it("次の人の手番になる（時計回り）", () => {
    const state = setupTable();
    const hand = state.hands.d!;

    const next = throwCards(state, "d", ids(hand.slice(0, 3)), noShuffle);

    expect(currentThrower(next)).toBe("a");
  });

  it("元の状態は書き換えない", () => {
    const state = setupTable();
    const before = structuredClone(state);

    throwCards(state, "d", ids(state.hands.d!.slice(0, 3)), noShuffle);

    expect(state).toEqual(before);
  });

  it("手番でない人は投げられない", () => {
    const state = setupTable();

    expect(() => throwCards(state, "a", ids(state.hands.a!.slice(0, 3)), noShuffle)).toThrow(
      new GameRuleError("a の手番ではない")
    );
  });

  it.each([
    ["2枚", (hand: Card[]) => ids(hand.slice(0, 2))],
    ["4枚", (hand: Card[]) => ids(hand.slice(0, 4))],
  ])("狙いが%sでは投げられない", (_label, pick) => {
    const state = setupTable();

    expect(() => throwCards(state, "d", pick(state.hands.d!), noShuffle)).toThrow(
      new GameRuleError("狙いは3枚出す")
    );
  });

  it("同じカードを2回出せない", () => {
    const state = setupTable();
    const [first, second] = ids(state.hands.d!);

    expect(() => throwCards(state, "d", [first!, first!, second!], noShuffle)).toThrow(
      new GameRuleError("同じカードを2回出している")
    );
  });

  it("手札に無いカードは出せない", () => {
    const state = setupTable();
    const [first, second] = ids(state.hands.d!);

    expect(() => throwCards(state, "d", [first!, second!, 9999], noShuffle)).toThrow(
      new GameRuleError("手札に無いカード: 9999")
    );
  });

  it("終わったゲームでは投げられない", () => {
    const state = setupTable({ phase: "finished", winners: ["a"] });

    expect(() => throwCards(state, "d", ids(state.hands.d!.slice(0, 3)), noShuffle)).toThrow(
      new GameRuleError("ゲームは終わっている")
    );
  });
});

/** 手番の人に手札の先頭3枚を出させて、1ラウンド投げ切る */
function playRound(state: GameState, rng: Rng = noShuffle): GameState {
  let next = state;
  for (let i = 0; i < state.players.length; i++) {
    const player = currentThrower(next);
    next = throwCards(next, player, ids(next.hands[player]!.slice(0, 3)), rng);
  }
  return next;
}

describe("ラウンドの終わり（4.4 回収）", () => {
  it("全員が投げ終わったら、山札の残り → 投げた順に狙い・めくり札 → 余り札の順に重ね、1回カットして配り直す", () => {
    const start = setupTable();
    const order = ["d", "a", "b", "c"] as const;
    const remaining = start.deck.slice(20);

    // 投げる前の手札と山札から、spec 4.4 の手順どおりに重ねた山を作る
    const collected = [
      ...remaining,
      ...order.flatMap((p, i) => [
        ...start.hands[p]!.slice(0, 3),
        ...start.deck.slice(i * 5, i * 5 + 5),
      ]),
      ...order.flatMap((p) => start.hands[p]!.slice(3)),
    ];
    // noShuffle はカット位置に最後（40枚目の後ろ）を選ぶ → 最後の1枚が一番上に来る
    const cut = [...collected.slice(40), ...collected.slice(0, 40)];

    const next = playRound(start);

    // スタートは左隣の a（2番目の席）へ。a から時計回りに配る。
    // id は配り直しで 2000 + 山札の何枚目か（noShuffle）に振り直る。数字はカットした山のまま
    const targets = (cards: Card[]) => cards.map((c) => c.target);
    expect(next.startIndex).toBe(1);
    expect(targets(next.hands.a!)).toEqual(targets([0, 4, 8, 12, 16].map((i) => cut[i]!)));
    expect(ids(next.hands.a!)).toEqual([2000, 2004, 2008, 2012, 2016]);
    expect(targets(next.hands.d!)).toEqual(targets([3, 7, 11, 15, 19].map((i) => cut[i]!)));
    expect(targets(next.deck)).toEqual(targets(cut.slice(20)));
    expect(collected).toHaveLength(41);
  });

  it("カット位置は、両方の山が1枚以上になる位置から一様に選ぶ（解釈メモ9）", () => {
    const calls: number[] = [];
    const spy: Rng = {
      nextInt(n) {
        calls.push(n);
        return 0;
      },
    };

    const start = setupTable();

    const next = playRound(start, spy);

    // 投げ終わって最初に引く乱数がカット位置。41枚の山を 1〜40 枚目の後ろで分ける → 40 通り
    expect(calls[0]).toBe(40);
    // 0 を選ぶと「1枚目の後ろ」で分ける。重ねた山の1枚目（山札の残り）が一番下へ行く
    expect(next.deck.at(-1)!.target).toBe(start.deck[20]!.target);
  });

  it("次のラウンドに進み、前のラウンドの投げは lastRoundThrows に残る", () => {
    const next = playRound(setupTable());

    expect(next).toMatchObject({ round: 2, throws: [], phase: "throwing" });
    expect(next.lastRoundThrows.map((t) => t.player)).toEqual(["d", "a", "b", "c"]);
    expect(currentThrower(next)).toBe("a");
  });

  it("マークはラウンドをまたいで残る", () => {
    const hand = cards(15, 15, 15, 16, 16);
    const deck = [...cards(15, 15, 15, 17, 17), ...setupTable().deck];
    const next = playRound(setupTable({ hands: { ...setupTable().hands, d: hand }, deck }));

    expect(next.marks.d![15]).toBe(3);
  });
});

describe("勝利（6章）", () => {
  const allOpenExceptBull = (): Marks => ({
    ...emptyMarks(),
    15: 3,
    16: 3,
    17: 3,
    18: 3,
    19: 3,
    20: 3,
    bull: 2,
  });

  /** d と b が Bull にあと1マークの状態。d は Bull を当てる手札・山札を持つ */
  function nearlyDone() {
    const table = setupTable();
    const hand = cards("bull", 15, 15, 16, 16);
    const deck = [...cards("bull", 17, 17, 17, 17), ...table.deck.slice(5)];
    return setupTable({
      hands: { ...table.hands, d: hand },
      deck,
      marks: { ...table.marks, d: allOpenExceptBull(), b: allOpenExceptBull() },
    });
  }

  it("全部オープンした人が出ても、そのラウンドは最後の人まで投げ切る", () => {
    const state = nearlyDone();

    const next = throwCards(state, "d", ids(state.hands.d!.slice(0, 3)), noShuffle);

    expect(next.marks.d!.bull).toBe(3);
    expect(next.phase).toBe("throwing");
    expect(currentThrower(next)).toBe("a");
  });

  it("ラウンドの終わりに全部オープンしている人が勝ち、ゲームが終わる", () => {
    const next = playRound(nearlyDone());

    expect(next).toMatchObject({ phase: "finished", winners: ["d"], round: 1 });
    expect(next.lastRoundThrows).toHaveLength(4);
  });

  it("同じラウンドで複数人が上がったら、全員が勝ち（暫定で共同優勝。解釈メモ10）", () => {
    const state = nearlyDone();
    // b にも Bull が当たるように、b の手番でめくる札（3人目 = 山札の 11〜15 枚目）に Bull を置く
    const deck = [...state.deck];
    deck[10] = { id: 5000, target: "bull" };
    const hands = {
      ...state.hands,
      b: [{ id: 5001, target: "bull" as const }, ...state.hands.b!.slice(1)],
    };

    const next = playRound({ ...state, deck, hands });

    expect(next.winners).toEqual(["d", "b"]); // 席順
  });

  it("誰も上がっていなければ続く", () => {
    expect(playRound(setupTable())).toMatchObject({ phase: "throwing", winners: null });
  });
});

describe("1ゲームを最後まで", () => {
  /** 山札・手札・このラウンドの投げに出ているカードをすべて集める */
  function allCards(state: GameState): Card[] {
    return [
      ...state.deck,
      ...Object.values(state.hands).flat(),
      ...state.throws.flatMap((t) => [...t.aims, ...t.flips]),
    ];
  }

  it.each([2, 3, 4])(
    "%i 人で 200 ゲーム、狙いを乱数で選んでも、カードは常に41枚のまま重複せず、必ず終わる",
    (playerCount) => {
      const players = ["a", "b", "c", "d"].slice(0, playerCount);
      for (let seed = 0; seed < 200; seed++) {
        const rng = createRng(seed);
        let state = createGame(players, rng);
        while (state.phase === "throwing") {
          const player = currentThrower(state);
          const hand = shuffle(state.hands[player]!, rng);
          state = throwCards(state, player, ids(hand.slice(0, 3)), rng);

          if (state.phase === "throwing") {
            const cardIds = ids(allCards(state));
            expect(new Set(cardIds).size).toBe(41);
            expect(cardIds).toHaveLength(41);
          }
          expect(state.round).toBeLessThan(200);
        }
        expect(state.winners!.length).toBeGreaterThan(0);
      }
    }
  );
});
