import type { GameView, ThrowRecord } from "@three-marks/engine";

/** 指の位置（基準座標）と時刻（ミリ秒） */
export type Point = { x: number; y: number; t: number };
/** めくる札の置き場所（中心と大きさ） */
export type Slot = { x: number; y: number; width: number; height: number };

export type Gesture = { kind: "tap" | "peel"; slot: number } | { kind: "sweep" };

/** これより動かなければタップ（指のぶれ） */
const TAP_MOVE = 12;
const TAP_MS = 300;
/** 一気にめくるスワイプ：横に札2枚分以上、縦の動きの2倍以上（ほぼ横向き） */
const SWEEP_SLOTS = 2;
const SWEEP_FLATNESS = 2;
/** 札の高さのこの割合だけ指を動かしたらめくりきる */
const PEEL_LENGTH = 0.8;
/** ここまでめくったら、指を離しても表になる */
export const REVEAL_AT = 0.6;

const slotAt = (slots: readonly Slot[], { x, y }: Point) =>
  slots.findIndex((s) => Math.abs(x - s.x) <= s.width / 2 && Math.abs(y - s.y) <= s.height / 2);

/**
 * 指の動きを、札への操作に読み替える。
 * - 札の上で短く触れて離す → タップ（その札をめくる）
 * - 札の列を横に大きく払う → 一気に全部めくる
 * - 札の上から指を動かす → その札を絞る
 */
export function classifyGesture(points: readonly Point[], slots: readonly Slot[]): Gesture | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const ms = Math.max(1, last.t - first.t);
  if (
    Math.abs(dx) >= slots[0]!.width * SWEEP_SLOTS &&
    Math.abs(dx) >= Math.abs(dy) * SWEEP_FLATNESS
  ) {
    return { kind: "sweep" };
  }
  const slot = slotAt(slots, first);
  if (slot < 0) return null;
  const tap = Math.hypot(dx, dy) < TAP_MOVE && ms <= TAP_MS;
  return { kind: tap ? "tap" : "peel", slot };
}

/** 絞っている札がどれだけめくれたか（0〜1）。動かした向きは問わない */
export function peelProgress(start: Point, current: Point, height: number): number {
  const moved = Math.hypot(current.x - start.x, current.y - start.y);
  return Math.min(1, moved / (height * PEEL_LENGTH));
}

/**
 * めくれた札を置き場所に割り当てる。flips はめくれた順（山札の上から）、touched は指が触れた置き場所の順。
 * i 枚目にめくれた札は i 番目に触れた置き場所へ。触れた順より多くめくれていたら（一気にめくった・
 * ほかの画面でめくった）、空いている置き場所に左から入れる。
 */
export function slotFaces<T>(
  count: number,
  flips: readonly T[],
  touched: readonly number[]
): (T | null)[] {
  const slots: (T | null)[] = Array.from({ length: count }, () => null);
  const free = Array.from({ length: count }, (_, i) => i).filter((i) => !touched.includes(i));
  flips.forEach((face, i) => {
    const slot = i < touched.length ? touched[i]! : free.shift()!;
    slots[slot] = face;
  });
  return slots;
}

/** その人の一番新しい投げ。めくり終えると照合されて投げに移るので、最後の1枚はここから受け取る */
export function latestThrowOf(
  view: Pick<GameView, "throws" | "lastRoundThrows">,
  player: string
): ThrowRecord | null {
  return (
    [...view.lastRoundThrows, ...view.throws].filter((t) => t.player === player).at(-1) ?? null
  );
}
