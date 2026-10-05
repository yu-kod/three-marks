import {
  addMarks,
  deadTargets,
  emptyMarks,
  hasOpenedAll,
  openedTargets,
  type Marks,
} from "./marks.js";
import { shuffle, type Rng } from "./rng.js";
import { MAX_PLAYERS, MIN_PLAYERS, rulesFor, type Rules } from "./rules.js";
import { TARGETS, type Target } from "./targets.js";
import { resolveThrow, type ThrowResult } from "./throw.js";

export type PlayerId = string;

/** 1枚のカード。id はゲーム中ずっと変わらない（画面でカードの動きを追うため） */
export type Card = { id: number; target: Target };

/** 1回の投げの記録。狙いとめくり札は出た順のまま公開される（4.2-4） */
export type ThrowRecord = {
  player: PlayerId;
  aims: Card[];
  flips: Card[];
  result: ThrowResult;
};

/**
 * ゲームの完全な状態（サーバーだけが持つ）。
 *
 * 山札の中身と順番、他人の手札を含むので、そのままクライアントへ返さない（CLAUDE.md）。
 */
export type GameState = {
  rules: Rules;
  /** 席順（時計回り） */
  players: PlayerId[];
  marks: Record<PlayerId, Marks>;
  round: number;
  /** このラウンドのスタートプレイヤーの席 */
  startIndex: number;
  /** 山札。先頭が一番上 */
  deck: Card[];
  hands: Record<PlayerId, Card[]>;
  /** このラウンドの投げ（投げた順） */
  throws: ThrowRecord[];
  /** 前のラウンドの投げ。ラウンドが変わっても、最後の投げの結果を画面に出せるように残す */
  lastRoundThrows: ThrowRecord[];
  phase: "throwing" | "finished";
  /** 勝った人（同時上がりは全員。解釈メモ10）。終わるまでは null */
  winners: PlayerId[] | null;
};

/** ルール上できない操作（手番でない、手札に無いカードを出した等） */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

function createDeck(rules: Rules): Card[] {
  const deck: Card[] = [];
  for (const target of TARGETS) {
    for (let i = 0; i < rules.deck[target]; i++) {
      deck.push({ id: deck.length, target });
    }
  }
  return deck;
}

/**
 * スタートプレイヤーから時計回りに1枚ずつ、全員が手札の枚数になるまで配る（4.1・解釈メモ8）。
 */
function deal(
  deck: readonly Card[],
  players: readonly PlayerId[],
  startIndex: number,
  handSize: number
): { deck: Card[]; hands: Record<PlayerId, Card[]> } {
  const hands: Record<PlayerId, Card[]> = Object.fromEntries(players.map((p) => [p, []]));
  let top = 0;
  for (let round = 0; round < handSize; round++) {
    for (let offset = 0; offset < players.length; offset++) {
      const player = players[(startIndex + offset) % players.length]!;
      hands[player]!.push(deck[top++]!);
    }
  }
  return { deck: deck.slice(top), hands };
}

/** ゲームを始める。41枚をシャッフルするのはこの1回だけ（3章） */
export function createGame(players: readonly PlayerId[], rng: Rng): GameState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameRuleError(`${MIN_PLAYERS}〜${MAX_PLAYERS}人で遊ぶ（${players.length}人）`);
  }
  if (new Set(players).size !== players.length) {
    throw new GameRuleError("同じプレイヤーが2回いる");
  }

  const rules = rulesFor(players.length);
  const shuffled = shuffle(createDeck(rules), rng);
  const startIndex = rng.nextInt(players.length);
  const { deck, hands } = deal(shuffled, players, startIndex, rules.handSize);

  return {
    rules,
    players: [...players],
    marks: Object.fromEntries(players.map((p) => [p, emptyMarks()])),
    round: 1,
    startIndex,
    deck,
    hands,
    throws: [],
    lastRoundThrows: [],
    phase: "throwing",
    winners: null,
  };
}

/** 今投げる人 */
export function currentThrower(state: GameState): PlayerId {
  return state.players[(state.startIndex + state.throws.length) % state.players.length]!;
}

/** 手札から狙いを選び出す。狙いは選んだ順のまま */
function takeAims(hand: readonly Card[], aimIds: readonly number[], aimCount: number) {
  if (aimIds.length !== aimCount) {
    throw new GameRuleError(`狙いは${aimCount}枚出す`);
  }
  if (new Set(aimIds).size !== aimIds.length) {
    throw new GameRuleError("同じカードを2回出している");
  }
  const aims = aimIds.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card) {
      throw new GameRuleError(`手札に無いカード: ${id}`);
    }
    return card;
  });
  return { aims, rest: hand.filter((c) => !aimIds.includes(c.id)) };
}

/**
 * 手番の人が投げる（4.2・4.3）。
 *
 * 手札から狙いを出し、山札の上からめくって照合し、マークを付ける。
 * ワイルドと死に番は投げる前の状態で判定する（解釈メモ3）。
 */
export function throwCards(
  state: GameState,
  player: PlayerId,
  aimIds: readonly number[],
  rng: Rng
): GameState {
  if (state.phase === "finished") {
    throw new GameRuleError("ゲームは終わっている");
  }
  if (currentThrower(state) !== player) {
    throw new GameRuleError(`${player} の手番ではない`);
  }

  const { aims, rest } = takeAims(state.hands[player]!, aimIds, state.rules.aimCount);
  const flips = state.deck.slice(0, state.rules.flipCount);
  const result = resolveThrow({
    aims: aims.map((c) => c.target),
    flips: flips.map((c) => c.target),
    opened: openedTargets(state.marks[player]!),
    dead: deadTargets(Object.values(state.marks)),
  });
  const gained = [...result.hits, ...result.wildHits.map((w) => w.aim)];

  const thrown: GameState = {
    ...state,
    deck: state.deck.slice(flips.length),
    hands: { ...state.hands, [player]: rest },
    marks: { ...state.marks, [player]: addMarks(state.marks[player]!, gained) },
    throws: [...state.throws, { player, aims, flips, result }],
  };

  return thrown.throws.length === state.players.length ? endRound(thrown, rng) : thrown;
}

/**
 * 全員が投げ終わったら、勝負がついていれば終わり、ついていなければ回収して次のラウンドへ（4.4・6章）。
 *
 * 山札の残り → 投げた順に「狙い → めくり札」→ 投げた順に余り札、の順に重ねて1回だけカットする。
 * シャッフルはしない。
 */
function endRound(state: GameState, rng: Rng): GameState {
  // 全部オープンした人が出たら、このラウンドを投げ切った今が終わり（6章）
  const winners = state.players.filter((p) => hasOpenedAll(state.marks[p]!));
  if (winners.length > 0) {
    return { ...state, throws: [], lastRoundThrows: state.throws, phase: "finished", winners };
  }

  const collected = [
    ...state.deck,
    ...state.throws.flatMap((t) => [...t.aims, ...t.flips]),
    ...state.throws.flatMap((t) => state.hands[t.player]!),
  ];
  // 1〜(枚数-1) 枚目の後ろのどこかで分けて、上下を入れ替える（解釈メモ9）
  const at = 1 + rng.nextInt(collected.length - 1);
  const cut = [...collected.slice(at), ...collected.slice(0, at)];

  const startIndex = (state.startIndex + 1) % state.players.length;
  const { deck, hands } = deal(cut, state.players, startIndex, state.rules.handSize);

  return {
    ...state,
    round: state.round + 1,
    startIndex,
    deck,
    hands,
    throws: [],
    lastRoundThrows: state.throws,
  };
}
