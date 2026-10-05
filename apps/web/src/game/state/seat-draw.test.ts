import { describe, expect, it } from "vitest";
import { seatDrawRounds, shouldPlayReveal } from "./seat-draw";
import { buildRoom } from "@/test-utils/table";

const member = (id: string, name: string) => ({ id, name, cpu: false });

describe("seatDrawRounds", () => {
  it("引いた回ごとに、誰が何を引いたかを並べる。2回目からは引き直し", () => {
    const room = buildRoom({
      members: [member("a", "あなた"), member("b", "ペンギン"), member("c", "キツネ")],
      seatDraw: [
        [
          { player: "b", target: 20 },
          { player: "a", target: 20 },
          { player: "c", target: "bull" },
        ],
        [
          { player: "b", target: 15 },
          { player: "a", target: 18 },
        ],
      ],
    });

    expect(seatDrawRounds(room)).toEqual([
      {
        label: "1回目",
        draws: [
          { name: "ペンギン", target: 20 },
          { name: "あなた", target: 20 },
          { name: "キツネ", target: "bull" },
        ],
      },
      {
        label: "引き直し",
        draws: [
          { name: "ペンギン", target: 15 },
          { name: "あなた", target: 18 },
        ],
      },
    ]);
  });

  it("引いていなければ null", () => {
    expect(seatDrawRounds(buildRoom({ seatDraw: null }))).toBeNull();
  });
});

describe("shouldPlayReveal", () => {
  const drawn = JSON.stringify([[{ player: "a", target: 20 }]]);

  it("新しく引いたときだけ、めくって見せる", () => {
    expect(shouldPlayReveal(JSON.stringify(null), drawn)).toBe(true);
    expect(shouldPlayReveal(JSON.stringify([[{ player: "a", target: 15 }]]), drawn)).toBe(true);
  });

  it("開いたときにもう引いてあった・前と同じ・引いていないときは見せない", () => {
    expect(shouldPlayReveal(undefined, drawn)).toBe(false);
    expect(shouldPlayReveal(drawn, drawn)).toBe(false);
    expect(shouldPlayReveal(drawn, JSON.stringify(null))).toBe(false);
  });
});
