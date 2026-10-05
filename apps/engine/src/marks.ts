import { TARGETS, type Target } from "./targets.js";

/** この数だけマークがたまった数字はオープン（docs/spec.md 5章） */
export const MARKS_TO_OPEN = 3;

/** 1人分のマーク欄。数字ごとに 0〜3 */
export type Marks = Record<Target, number>;

export function emptyMarks(): Marks {
  return Object.fromEntries(TARGETS.map((target) => [target, 0])) as Marks;
}

/** 当たった数字ごとに1マーク足す。3を超えた分は捨てる */
export function addMarks(marks: Marks, gained: readonly Target[]): Marks {
  const next = { ...marks };
  for (const target of gained) {
    next[target] = Math.min(MARKS_TO_OPEN, next[target] + 1);
  }
  return next;
}

export function openedTargets(marks: Marks): Set<Target> {
  return new Set(TARGETS.filter((target) => marks[target] >= MARKS_TO_OPEN));
}

/** 全員がオープンした数字（死に番）。誰のワイルドにもならない */
export function deadTargets(players: readonly Marks[]): Set<Target> {
  if (players.length === 0) {
    return new Set();
  }
  return new Set(TARGETS.filter((target) => players.every((m) => m[target] >= MARKS_TO_OPEN)));
}

/** 7つすべてをオープンしたか（上がり。6章） */
export function hasOpenedAll(marks: Marks): boolean {
  return openedTargets(marks).size === TARGETS.length;
}
