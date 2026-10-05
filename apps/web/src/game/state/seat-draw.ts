import type { Target } from "@three-marks/engine";
import type { RoomView } from "./types";

export type SeatDrawRound = { label: string; draws: { name: string; target: Target }[] };

/** カードを引いて席順を決めた結果を、引いた回ごとに見せる形にする（解釈メモ12：誰が何を引いたかを全員に見せる） */
export function seatDrawRounds(room: RoomView): SeatDrawRound[] | null {
  if (room.seatDraw === null) return null;
  const names = new Map(room.members.map((m) => [m.id, m.name]));
  return room.seatDraw.map((round, i) => ({
    label: i === 0 ? "1回目" : "引き直し",
    // 席に出入りがあると引いた結果は消える（サーバーが seatDraw を null にする）ので、引いた人は必ず席にいる
    draws: round.map(({ player, target }) => ({ name: names.get(player)!, target })),
  }));
}

/**
 * 引いた結果をめくって見せるか。previous は前に描いたときの seatDraw（JSON）、まだ描いていなければ undefined。
 * 開いたときにもう引いてあったものは、めくらずにそのまま見せる。
 */
export function shouldPlayReveal(previous: string | undefined, next: string): boolean {
  return previous !== undefined && previous !== next && next !== "null";
}
