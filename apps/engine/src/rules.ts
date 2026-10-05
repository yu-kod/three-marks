import type { Target } from "./targets.js";

/**
 * 人数ごとの設定（docs/spec.md 1章・7章）。
 *
 * 数値はシミュレーションとプレイテストで変わる前提なので、実装に埋め込まずここに集める。
 */
export type Rules = {
  handSize: number;
  /** 1回の投げで手札から出す狙いの枚数 */
  aimCount: number;
  /** 1回の投げで山札からめくる枚数 */
  flipCount: number;
  /** 数字ごとの枚数 */
  deck: Record<Target, number>;
};

const DECK: Record<Target, number> = { 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6, bull: 5 };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export function rulesFor(playerCount: number): Rules {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RangeError(`${MIN_PLAYERS}〜${MAX_PLAYERS}人で遊ぶ（${playerCount}人）`);
  }
  return {
    handSize: 5,
    aimCount: 3,
    // 2人だと5枚では空振りが多く間延びする（7章）
    flipCount: playerCount === 2 ? 8 : 5,
    deck: { ...DECK },
  };
}

export function deckSize(rules: Rules): number {
  return Object.values(rules.deck).reduce((sum, n) => sum + n, 0);
}
