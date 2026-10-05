import { describe, expect, it } from "vitest";
import { createGame, currentThrower, throwCards, type GameState } from "./game.js";
import { createRng, type Rng } from "./rng.js";
import { viewFor } from "./view.js";

const noShuffle: Rng = { nextInt: (n) => n - 1 };

/** スタートは d。d が投げ終わって a の手番 */
function midRound(): GameState {
  const game = createGame(["a", "b", "c", "d"], noShuffle);
  return throwCards(
    game,
    "d",
    game.hands.d!.slice(0, 3).map((c) => c.id),
    noShuffle
  );
}

/** オブジェクトの中に出てくるカード（id と target を持つもの）の id をすべて集める */
function cardIdsIn(value: unknown, found = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    value.forEach((v) => cardIdsIn(v, found));
  } else if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.id === "number" && "target" in record) {
      found.add(record.id);
    }
    Object.values(record).forEach((v) => cardIdsIn(v, found));
  }
  return found;
}

describe("viewFor — 裏向き情報を漏らさない", () => {
  it.each([["a"], ["b"], [null]])("%s 向けの状態に、山札のカードは1枚も含まれない", (viewer) => {
    const state = midRound();

    const ids = cardIdsIn(viewFor(state, viewer));

    for (const card of state.deck) {
      expect(ids.has(card.id)).toBe(false);
    }
  });

  it("他人の手札のカードは含まれない", () => {
    const state = midRound();

    const ids = cardIdsIn(viewFor(state, "a"));

    for (const player of ["b", "c", "d"]) {
      for (const card of state.hands[player]!) {
        expect(ids.has(card.id)).toBe(false);
      }
    }
  });

  it("観戦者には誰の手札も見せない", () => {
    const state = midRound();

    const view = viewFor(state, null);

    expect(view.myHand).toBeNull();
    const ids = cardIdsIn(view);
    for (const hand of Object.values(state.hands)) {
      for (const card of hand) expect(ids.has(card.id)).toBe(false);
    }
  });

  it("参加していない人を指定したら観戦者として扱う", () => {
    expect(viewFor(midRound(), "stranger").myHand).toBeNull();
  });

  it("ラウンドが進んでも、表になったことのないカードは出てこない（乱数で数ラウンド進めて毎回確かめる）", () => {
    // 前のラウンドで表になった狙いとめくり札は、回収されて山札や手札に戻っても
    // 「表になった」公開情報として lastRoundThrows に残る。どこへ戻ったかは見せないので
    // 漏れではない。表になったことのないカード（裏の余り札、山札の残り）だけを調べる
    const rng = createRng(3);
    let state = createGame(["a", "b", "c"], rng);
    for (let i = 0; i < 30 && state.phase === "throwing"; i++) {
      const player = currentThrower(state);
      state = throwCards(
        state,
        player,
        state.hands[player]!.slice(0, 3).map((c) => c.id),
        rng
      );

      const view = viewFor(state, "a");
      const revealed = cardIdsIn([view.throws, view.lastRoundThrows]);
      const ids = cardIdsIn(view);
      const hidden = [...state.deck, ...state.hands.b!, ...state.hands.c!];
      for (const card of hidden.filter((c) => !revealed.has(c.id))) {
        expect(ids.has(card.id)).toBe(false);
      }
    }
  });

  it("前のラウンドで表になったカードがどこへ戻ったかは見せない", () => {
    const rng = createRng(3);
    let state = createGame(["a", "b", "c"], rng);
    for (let i = 0; i < 3; i++) {
      const player = currentThrower(state);
      state = throwCards(
        state,
        player,
        state.hands[player]!.slice(0, 3).map((c) => c.id),
        rng
      );
    }

    const view = viewFor(state, "a");

    // 手札の中身は自分の分だけ、山札は枚数だけ。表になったカードの今の居場所は分からない
    expect(view.lastRoundThrows).toHaveLength(3);
    expect(Object.keys(view)).not.toContain("deck");
    expect(view.players.every((p) => !("hand" in p))).toBe(true);
  });
});

describe("viewFor — 見せる情報", () => {
  it("自分の手札、全員のマークと手札の枚数、山札の枚数、手番を見せる", () => {
    const state = midRound();

    const view = viewFor(state, "a");

    expect(view.myHand).toEqual(state.hands.a);
    expect(view.players).toEqual([
      { id: "a", marks: state.marks.a, handCount: 5 },
      { id: "b", marks: state.marks.b, handCount: 5 },
      { id: "c", marks: state.marks.c, handCount: 5 },
      { id: "d", marks: state.marks.d, handCount: 2 },
    ]);
    expect(view).toMatchObject({
      round: 1,
      deckCount: state.deck.length,
      startPlayer: "d",
      currentThrower: "a",
      phase: "throwing",
      winners: null,
      rules: { handSize: 5, aimCount: 3, flipCount: 5 },
    });
  });

  it("このラウンドと前のラウンドの投げ（狙いとめくり札、照合の結果）は公開情報として見せる", () => {
    const state = midRound();

    const view = viewFor(state, "b");

    expect(view.throws).toEqual(state.throws);
    expect(view.lastRoundThrows).toEqual([]);
  });

  it("終わったゲームでは手番が無く、勝者を見せる", () => {
    const state: GameState = { ...midRound(), phase: "finished", winners: ["d"] };

    expect(viewFor(state, "a")).toMatchObject({
      phase: "finished",
      winners: ["d"],
      currentThrower: null,
    });
  });
});

describe("viewFor — ラウンドをまたいでカードを追えない", () => {
  it("前のラウンドで表になったカードの id は、今のラウンドのカードの id と1つも重ならない", () => {
    // id がゲーム中ずっと同じだと、回収の順番（公開情報）と今のめくり札の id を照らし合わせて
    // カットの位置が分かり、山札の並びがほぼ読めてしまう。id はラウンドごとに振り直す
    const rng = createRng(11);
    let state = createGame(["a", "b", "c", "d"], rng);
    for (let round = 0; round < 5 && state.phase === "throwing"; round++) {
      for (let i = 0; i < 4 && state.phase === "throwing"; i++) {
        const player = currentThrower(state);
        state = throwCards(
          state,
          player,
          state.hands[player]!.slice(0, 3).map((c) => c.id),
          rng
        );
      }
      if (state.phase === "finished") break;

      const view = viewFor(state, "a");
      const before = cardIdsIn(view.lastRoundThrows);
      const now = cardIdsIn([...state.deck, ...Object.values(state.hands).flat()]);
      for (const id of before) expect(now.has(id)).toBe(false);
    }
  });

  it("振り直した id から、カードの位置（山札の何枚目か、配られた順）が分からない", () => {
    // id を山札の並び順に振ると、手札の id の大小から配られた順番が分かる
    const state = createGame(["a", "b", "c", "d"], createRng(21));
    const deckIds = state.deck.map((c) => c.id);

    expect(deckIds).not.toEqual([...deckIds].sort((x, y) => x - y));
  });
});
