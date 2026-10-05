import type { Target } from "@three-marks/engine";

/** カードの表に何を出すか（裏向きなら back） */
export type CardFace =
  { kind: "number"; value: Exclude<Target, "bull"> } | { kind: "bull" } | { kind: "back" };

export function cardFaceOf(target: Target): CardFace {
  return target === "bull" ? { kind: "bull" } : { kind: "number", value: target };
}
