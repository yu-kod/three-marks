import type { Award } from "@three-marks/engine";

export type CutInKind = Award["kind"];

/** 出すカットイン。tier が大きいほど派手に（大きく・長く・揺れ・粒） */
export type CutIn = {
  kind: CutInKind;
  tier: number;
  /** 誰の投げか */
  who: string;
  /** この投げで開いた数字（強い順） */
  opened: string[];
  /** 自分の投げか（ほかの人の投げは控えめに出す） */
  mine: boolean;
};

/** 格の高い順（docs/spec.md 解釈メモ16） */
const TIERS: Record<CutInKind, number> = {
  GAME_SHOT: 6,
  THREE_IN_A_BED: 5,
  DOUBLE_BULL: 4,
  THREE_MARKS: 3,
  DOUBLE_OPEN: 2,
  OPEN: 1,
};

/**
 * 1回の投げのアワードから、出すカットインを1つ決める。一番格の高いものを大きく出し、
 * 開いた数字はどのカットインにも添える（OPEN を別に何度も出さない）。
 */
export function cutInFor(awards: readonly Award[], who: string, mine: boolean): CutIn | null {
  if (awards.length === 0) return null;
  // awardsFor（エンジン）は格の高い順に並べて返す
  const top = awards[0]!;
  const opened = awards.flatMap((a) =>
    a.kind === "OPEN" ? [a.target === "bull" ? "BULL" : String(a.target)] : []
  );
  return { kind: top.kind, tier: TIERS[top.kind], who, opened, mine };
}
