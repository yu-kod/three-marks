import {
  deadTargets,
  openedTargets,
  type Card,
  type GameView,
  type Target,
  type ThrowRecord,
} from "@three-marks/engine";
import { cardFaceOf, type CardFace } from "./card-face";
import type { RoomView } from "./types";

/** 得点表の並び（ダーツのクリケットと同じく 20 が上、BULL が下） */
const BOARD_ORDER: Target[] = [20, 19, 18, 17, 16, 15, "bull"];

export type FlipOutcome = "hit" | "wild" | "miss";

export type GameModel = {
  round: number;
  /** 席順 */
  players: {
    id: string;
    name: string;
    open: number;
    turn: boolean;
    me: boolean;
    winner: boolean;
  }[];
  /** marks は席順 */
  rows: { target: Target; marks: number[]; dead: boolean }[];
  /** 自分の手番で、狙いを選ぶ（select）かめくる（flip）か。手番でなければ null */
  myTurn: "select" | "flip" | null;
  /** 自分の手札。観戦者は null */
  hand: { id: number; face: CardFace }[] | null;
  aimCount: number;
  /** めくっている途中の投げ */
  current: { name: string; aims: CardFace[]; flips: CardFace[]; flipsLeft: number } | null;
  /** 直前の投げ（このラウンドに無ければ前のラウンドの最後） */
  lastThrow: {
    name: string;
    aims: CardFace[];
    flips: { face: CardFace; outcome: FlipOutcome }[];
  } | null;
  deckCount: number;
  result: { winners: string[]; iWon: boolean } | null;
};

const faces = (cards: readonly Card[]) => cards.map((c) => cardFaceOf(c.target));

/**
 * めくり札ごとの結果。通常の命中を先に数え、残りをワイルドに数える（解釈メモ1）。
 * 同じ数字のめくり札が何枚かあるときは、先にめくった札から当てる。
 */
export function flipOutcomes(record: ThrowRecord): FlipOutcome[] {
  const hits = [...record.result.hits];
  const wilds = record.result.wildHits.map((w) => w.wild);
  return record.flips.map(({ target }) => {
    const hit = hits.indexOf(target);
    if (hit >= 0) {
      hits.splice(hit, 1);
      return "hit";
    }
    const wild = wilds.indexOf(target);
    if (wild >= 0) {
      wilds.splice(wild, 1);
      return "wild";
    }
    return "miss";
  });
}

/** 狙いに選ぶ・外す。選べるのは max 枚まで（それより多くは選ばない） */
export function toggleAim(selected: readonly number[], id: number, max: number): number[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return selected.length < max ? [...selected, id] : [...selected];
}

function lastThrowOf(record: ThrowRecord, name: string): GameModel["lastThrow"] {
  const outcomes = flipOutcomes(record);
  return {
    name,
    aims: faces(record.aims),
    flips: record.flips.map((c, i) => ({ face: cardFaceOf(c.target), outcome: outcomes[i]! })),
  };
}

/** ゲーム中の画面に描くもの。me は今のゲストの ID（観戦者は null） */
export function gameModel(room: RoomView, view: GameView, me: string | null): GameModel {
  const names = new Map(room.members.map((m) => [m.id, m.name]));
  const nameOf = (id: string) => names.get(id)!;
  const dead = deadTargets(view.players.map((p) => p.marks));
  const winners = view.winners ?? [];
  const mine = view.currentThrower === me && me !== null;
  const last = view.throws.at(-1) ?? view.lastRoundThrows.at(-1) ?? null;

  return {
    round: view.round,
    players: view.players.map((p) => ({
      id: p.id,
      name: nameOf(p.id),
      open: openedTargets(p.marks).size,
      turn: p.id === view.currentThrower,
      me: p.id === me,
      winner: winners.includes(p.id),
    })),
    rows: BOARD_ORDER.map((target) => ({
      target,
      marks: view.players.map((p) => p.marks[target]),
      dead: dead.has(target),
    })),
    myTurn: mine ? (view.pending === null ? "select" : "flip") : null,
    hand: view.myHand?.map((c) => ({ id: c.id, face: cardFaceOf(c.target) })) ?? null,
    aimCount: view.rules.aimCount,
    current: view.pending && {
      name: nameOf(view.pending.player),
      aims: faces(view.pending.aims),
      flips: faces(view.pending.flips),
      flipsLeft: view.rules.flipCount - view.pending.flips.length,
    },
    lastThrow: last && lastThrowOf(last, nameOf(last.player)),
    deckCount: view.deckCount,
    result:
      view.phase === "finished"
        ? { winners: winners.map(nameOf), iWon: me !== null && winners.includes(me) }
        : null,
  };
}
