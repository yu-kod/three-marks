import type { JsonStorage } from "@app/web-core";
import type { CutIn } from "./cut-in";

/** 演出の強さ。設定で切り替える順 */
export const EFFECT_LEVELS = ["strong", "normal", "weak", "off"] as const;
export type EffectLevel = (typeof EFFECT_LEVELS)[number];

export const EFFECT_LABELS: Record<EffectLevel, string> = {
  strong: "強",
  normal: "標準",
  weak: "弱",
  off: "なし",
};

const STORAGE_KEY = "three-marks:effects";
const isLevel = (v: unknown): v is EffectLevel => EFFECT_LEVELS.includes(v as EffectLevel);

/** 端末に保存した演出の強さ。無い・知らない値なら標準 */
export function savedEffectLevel(storage: JsonStorage): EffectLevel {
  const level = storage.get<unknown>(STORAGE_KEY);
  return isLevel(level) ? level : "normal";
}

export function saveEffectLevel(level: EffectLevel, storage: JsonStorage): void {
  storage.set(STORAGE_KEY, level);
}

/** 設定ボタンを押したときの次の強さ（なしの次は強に戻る） */
export function nextEffectLevel(level: EffectLevel): EffectLevel {
  return EFFECT_LEVELS[(EFFECT_LEVELS.indexOf(level) + 1) % EFFECT_LEVELS.length]!;
}

/** 強さごとの、再生全体の速さと、当たったときの揺れ・光を出すか */
export function effectPlan(level: EffectLevel): { speed: number; shake: boolean; flash: boolean } {
  const quiet = level === "weak" || level === "off";
  return { speed: level === "off" ? 3 : quiet ? 1.5 : 1, shake: !quiet, flash: !quiet };
}

/** 早送りしているときの再生の速さ（強さの速さの4倍） */
export function playbackSpeed(level: EffectLevel, fastForward: boolean): number {
  return effectPlan(level).speed * (fastForward ? 4 : 1);
}

/** カットインの出し方。holdRate はスキンの cutInMs に掛ける、shake は揺れの強さ */
export type CutInStyle = {
  scale: number;
  holdRate: number;
  dim: number;
  flash: boolean;
  shake: number;
  confetti: number;
};

/**
 * カットインをどう出すか。出さないなら null。
 * 標準：自分の投げは格が高いほど長く・暗く、DOUBLE OPEN から光り、3 MARKS から揺れて紙吹雪。ほかの人の投げは小さく短く。
 * 強は長く派手に、弱は自分の投げだけ短く静かに、なしは出さない。同じ演出が続くとき（repeated）は短く。
 */
export function cutInStyle(level: EffectLevel, cut: CutIn, repeated: boolean): CutInStyle | null {
  if (level === "off" || (level === "weak" && !cut.mine)) return null;
  const { tier, mine } = cut;
  const scale = mine ? 1 : 0.78;
  const big = mine && tier >= 3;
  const style: CutInStyle = {
    scale,
    holdRate: mine ? 0.5 + tier * 0.18 : 0.45,
    dim: Math.min(0.85, 0.35 + tier * 0.08) * scale,
    flash: mine && tier >= 2,
    shake: big ? 0.003 * tier : 0,
    confetti: big ? 12 + tier * 8 : 0,
  };
  if (level === "strong") {
    style.holdRate *= 1.3;
    style.shake *= 1.5;
    style.confetti = Math.round(style.confetti * 1.5);
  } else if (level === "weak") {
    style.holdRate *= 0.6;
    style.flash = false;
    style.shake = 0;
    style.confetti = 0;
  }
  if (repeated) {
    style.holdRate *= 0.5;
    style.confetti = Math.round(style.confetti / 2);
  }
  return style;
}
