import { MARKS_TO_OPEN, type Marks } from "./marks.js";
import { TARGETS, type Target } from "./targets.js";
import type { ThrowResult } from "./throw.js";

/**
 * 投げの結果のアワード（#31、docs/spec.md「アワード」）。演出（カットイン）のきっかけで、ゲームの勝敗には関係しない。
 * 見た目はスキンが決める。並びは格の高い順（画面は先頭の1つを大きく出し、OPEN は一緒に出してよい）。
 */
export type Award =
  | { kind: "GAME_SHOT" }
  | { kind: "THREE_IN_A_BED" }
  | { kind: "DOUBLE_BULL" }
  | { kind: "THREE_MARKS" }
  | { kind: "DOUBLE_OPEN" }
  | { kind: "OPEN"; target: Target };

/** オープンまでに要る分を超えて捨てられたマークを除いた、実際に付いたマーク（数字ごと） */
function addedMarks(result: ThrowResult, before: Marks): Map<Target, number> {
  const gained = new Map<Target, number>();
  for (const target of [...result.hits, ...result.wildHits.map((w) => w.aim)]) {
    gained.set(target, (gained.get(target) ?? 0) + 1);
  }
  const added = new Map<Target, number>();
  // 照合はオープン済みの数字の狙いを当たりにしない（解釈メモ5）ので、ここに来る数字は必ず1マーク以上付く
  for (const [target, count] of gained) {
    added.set(target, Math.min(count, MARKS_TO_OPEN - before[target]));
  }
  return added;
}

/**
 * 1回の投げのアワード。照合の結果と、投げる前のその人のマークだけから決まる。
 */
export function awardsFor(result: ThrowResult, before: Marks): Award[] {
  const added = addedMarks(result, before);
  const total = [...added.values()].reduce((a, b) => a + b, 0);
  // 強い数字から
  const opened = [...TARGETS]
    .reverse()
    .filter((t) => before[t] < MARKS_TO_OPEN && before[t] + (added.get(t) ?? 0) >= MARKS_TO_OPEN);
  const allOpen = TARGETS.every((t) => before[t] + (added.get(t) ?? 0) >= MARKS_TO_OPEN);

  const awards: Award[] = [];
  if (allOpen && opened.length > 0) awards.push({ kind: "GAME_SHOT" });
  if (total === 3 && added.size === 1) awards.push({ kind: "THREE_IN_A_BED" });
  if ((added.get("bull") ?? 0) >= 2) awards.push({ kind: "DOUBLE_BULL" });
  if (total === 3) awards.push({ kind: "THREE_MARKS" });
  if (opened.length >= 2) awards.push({ kind: "DOUBLE_OPEN" });
  for (const target of opened) awards.push({ kind: "OPEN", target });
  return awards;
}
