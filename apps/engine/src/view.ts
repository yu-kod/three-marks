import {
  currentThrower,
  type Card,
  type GameState,
  type PendingThrow,
  type PlayerId,
  type ThrowRecord,
} from "./game.js";
import type { Marks } from "./marks.js";
import type { Rules } from "./rules.js";

/** 他のプレイヤーについて見えること */
export type PlayerView = {
  id: PlayerId;
  marks: Marks;
  /** 手札は枚数だけ */
  handCount: number;
};

/**
 * 1人のプレイヤー（または観戦者）に返してよい状態。
 *
 * 山札の中身と順番、他人の手札は含まない（CLAUDE.md「裏向き情報をクライアントへ返さない」）。
 * サーバーはこの型だけをクライアントへ返す。
 *
 * カードの id はゲーム中ずっと変わらない。前のラウンドで表になったカードは、回収されて
 * 山札や手札へ戻っても lastRoundThrows に id ごと残るが、表の数字は全員が見た公開情報で、
 * 今どこにあるか（山札の何枚目か、誰の手札か）はここに含めないので漏れにはならない。
 */
export type GameView = {
  /** デッキ構成（1章）は公開情報 */
  rules: Rules;
  round: number;
  /** 席順 */
  players: PlayerView[];
  startPlayer: PlayerId;
  /** 終わったゲームでは null */
  currentThrower: PlayerId | null;
  /** 山札は枚数だけ。順番は絶対に返さない */
  deckCount: number;
  /** 自分の手札。観戦者は null */
  myHand: Card[] | null;
  /** 狙いとめくり札は公開情報（4.2-4） */
  throws: ThrowRecord[];
  /** めくっている途中の投げ（狙いと、めくった札だけ。まだめくっていない札は山札の枚数に入る） */
  pending: PendingThrow | null;
  lastRoundThrows: ThrowRecord[];
  phase: GameState["phase"];
  winners: PlayerId[] | null;
};

/**
 * viewer 向けの状態を作る。viewer が null か参加者でなければ観戦者として扱う。
 *
 * 状態を丸ごと写さず、見せてよい項目だけを1つずつ選ぶ。GameState に項目が増えても、
 * ここに足さない限りクライアントへは出ない。
 */
export function viewFor(state: GameState, viewer: PlayerId | null): GameView {
  const isPlayer = viewer !== null && state.players.includes(viewer);
  return {
    rules: state.rules,
    round: state.round,
    players: state.players.map((id) => ({
      id,
      marks: state.marks[id]!,
      handCount: state.hands[id]!.length,
    })),
    startPlayer: state.players[state.startIndex]!,
    currentThrower: state.phase === "finished" ? null : currentThrower(state),
    deckCount: state.deck.length,
    myHand: isPlayer ? state.hands[viewer]! : null,
    throws: state.throws,
    pending: state.pending,
    lastRoundThrows: state.lastRoundThrows,
    phase: state.phase,
    winners: state.winners,
  };
}
