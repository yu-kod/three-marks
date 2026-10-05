import type { Award } from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import { cutInFor } from "./cut-in";

describe("cutInFor", () => {
  it("アワードが無ければ出さない", () => {
    expect(cutInFor([], "あなた", true)).toBeNull();
  });

  it("一番格の高いアワードを1つ大きく出す。開いた数字も添える", () => {
    const awards: Award[] = [
      { kind: "THREE_MARKS" },
      { kind: "DOUBLE_OPEN" },
      { kind: "OPEN", target: 20 },
      { kind: "OPEN", target: "bull" },
    ];

    expect(cutInFor(awards, "ペンギン", false)).toEqual({
      kind: "THREE_MARKS",
      tier: 3,
      who: "ペンギン",
      opened: ["20", "BULL"],
      mine: false,
    });
  });

  it("格の順：GAME SHOT > 3 IN A BED > DOUBLE BULL > 3 MARKS > DOUBLE OPEN > OPEN", () => {
    const tiers = (
      ["GAME_SHOT", "THREE_IN_A_BED", "DOUBLE_BULL", "THREE_MARKS", "DOUBLE_OPEN"] as const
    ).map((kind) => cutInFor([{ kind }], "a", true)!.tier);
    const open = cutInFor([{ kind: "OPEN", target: 15 }], "a", true)!;

    expect(tiers).toEqual([6, 5, 4, 3, 2]);
    expect(open).toMatchObject({ kind: "OPEN", tier: 1, opened: ["15"] });
  });
});
