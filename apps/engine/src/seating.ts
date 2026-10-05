import { GameRuleError, type PlayerId } from "./game.js";
import type { Rng } from "./rng.js";
import type { Rules } from "./rules.js";
import { strength, TARGETS, type Target } from "./targets.js";

/** 1人が引いた1枚 */
export type SeatDraw = { player: PlayerId; target: Target };

export type SeatDrawResult = {
  /** 決まった席順。1番目が最初のスタートプレイヤー（解釈メモ11） */
  order: PlayerId[];
  /** 引いた回ごとの結果。2回目以降は、同じ強さだった人たちの引き直し */
  rounds: SeatDraw[][];
};

/**
 * カードを引いて席順を決める（解釈メモ12。ダーツのコークに倣う）。
 *
 * 全員が1枚ずつ引き、強い順に席に着く。同じ強さの人たちは、その人たちだけで
 * 混ぜ直した山から引き直し、決まるまで繰り返す。誰が何を引いたかは rounds に残す。
 */
export function drawSeats(
  players: readonly PlayerId[],
  rules: Pick<Rules, "deck">,
  rng: Rng
): SeatDrawResult {
  if (new Set(players).size !== players.length) {
    throw new GameRuleError("同じプレイヤーが2回いる");
  }

  const fullPile = TARGETS.flatMap((target) => Array<Target>(rules.deck[target]).fill(target));
  const rounds: SeatDraw[][] = [];

  /** 毎回41枚を混ぜ直した山から、1人1枚ずつ引く */
  function drawRound(drawers: readonly PlayerId[]): SeatDraw[] {
    const pile = [...fullPile];
    const draws = drawers.map((player) => ({
      player,
      target: pile.splice(rng.nextInt(pile.length), 1)[0]!,
    }));
    rounds.push(draws);
    return draws;
  }

  function decide(drawers: readonly PlayerId[]): PlayerId[] {
    if (drawers.length === 1) {
      return [...drawers];
    }
    const draws = drawRound(drawers);
    const strengths = [...new Set(draws.map((d) => strength(d.target)))].sort((x, y) => y - x);
    return strengths.flatMap((s) =>
      decide(draws.filter((d) => strength(d.target) === s).map((d) => d.player))
    );
  }

  return { order: decide(players), rounds };
}
