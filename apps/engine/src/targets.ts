/**
 * 狙える数字。弱い順に並べてある（docs/spec.md 2章: 15 < 16 < … < 20 < Bull）。
 *
 * 強さはワイルドの効く範囲だけに使う。得点計算はない。
 */
export const TARGETS = [15, 16, 17, 18, 19, 20, "bull"] as const;

export type Target = (typeof TARGETS)[number];

/** 強さの順位（15 が 0、Bull が 6） */
export function strength(target: Target): number {
  return TARGETS.indexOf(target);
}
