import { chooseAims } from "./cpu.js";
import { currentThrower, declareAims, revealFlips, type GameState } from "./game.js";
import type { Rng } from "./rng.js";
import { viewFor } from "./view.js";

/**
 * 手番の人がいなくなったとき、サーバーが代わりに進める（解釈メモ17）。
 * 狙いを出す前なら CPU と同じ選び方で狙いを出し、残りを全部めくる。代わりに進めた投げには印（auto）を付ける。
 */
export function playForAbsent(state: GameState, rng: Rng): GameState {
  const player = currentThrower(state);
  const declared =
    state.pending === null
      ? declareAims(state, player, chooseAims(viewFor(state, player), rng))
      : state;
  const pending = { ...declared.pending!, auto: true as const };
  return revealFlips({ ...declared, pending }, player, state.rules.flipCount, rng);
}
