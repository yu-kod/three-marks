import { describe, expect, it } from "vitest";
import { GameRuleError } from "./game.js";
import { createRng, type Rng } from "./rng.js";
import { rulesFor } from "./rules.js";
import { drawSeats } from "./seating.js";

const rules = rulesFor(4);

/**
 * 引くカードを指定する乱数。山は弱い順（15 が 6枚 → 16 → … → Bull が 5枚）に並んでいて、
 * 引くたびに残りの山から nextInt で選ぶ。各回の最初の山（41枚）の中の位置は:
 *   15: 0〜5, 16: 6〜11, 17: 12〜17, 18: 18〜23, 19: 24〜29, 20: 30〜35, Bull: 36〜40
 */
function picks(...indices: number[]): Rng {
  let i = 0;
  return {
    nextInt: (n) => {
      const value = indices[i++];
      if (value === undefined || value >= n) throw new Error(`想定外の引き: ${i - 1}番目 (n=${n})`);
      return value;
    },
  };
}

describe("drawSeats — カードを引いて席順を決める（解釈メモ12）", () => {
  it("全員が1枚ずつ引き、強い順（Bull > 20 > … > 15）に席に着く", () => {
    // a: 15, b: Bull, c: 18（山から抜けた分だけ後ろがずれる）
    const result = drawSeats(["a", "b", "c"], rules, picks(0, 39, 17));

    expect(result.order).toEqual(["b", "c", "a"]);
    expect(result.rounds).toEqual([
      [
        { player: "a", target: 15 },
        { player: "b", target: "bull" },
        { player: "c", target: 18 },
      ],
    ]);
  });

  it("同じ強さを引いた人たちだけが引き直し、その中の順が決まる", () => {
    // 1回目: a 20, b 20, c 15 → a と b が引き直し。2回目: a 16, b 19 → b が先
    const result = drawSeats(["a", "b", "c"], rules, picks(30, 30, 0, 6, 24));

    expect(result.order).toEqual(["b", "a", "c"]);
    expect(result.rounds).toEqual([
      [
        { player: "a", target: 20 },
        { player: "b", target: 20 },
        { player: "c", target: 15 },
      ],
      [
        { player: "a", target: 16 },
        { player: "b", target: 19 },
      ],
    ]);
  });

  it("引き直しでも同じなら、決まるまで繰り返す", () => {
    const result = drawSeats(["a", "b"], rules, picks(0, 0, 36, 36, 6, 0));

    expect(result.order).toEqual(["a", "b"]);
    expect(result.rounds).toHaveLength(3);
  });

  it("下の方で同じ強さになっても、上の席は動かない", () => {
    // a Bull, b 15, c 15 → a が1番。b と c が引き直して c が先
    const result = drawSeats(["a", "b", "c"], rules, picks(36, 0, 0, 0, 39));

    expect(result.order).toEqual(["a", "c", "b"]);
  });

  it("引き直しは41枚を混ぜ直した山から引く（前の回に引いたカードも戻る）", () => {
    // 1回目に Bull を5枚中2枚引いても、2回目も41枚から引ける（n=41 で 40 を引ける）
    const result = drawSeats(["a", "b"], rules, picks(40, 39, 40, 0));

    expect(result.rounds[1]).toEqual([
      { player: "a", target: "bull" },
      { player: "b", target: 15 },
    ]);
  });

  it("乱数で何度やっても、全員がちょうど1回ずつ並ぶ", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const players = ["a", "b", "c", "d"].slice(0, 2 + (i % 3));

      const { order } = drawSeats(players, rules, rng);

      expect([...order].sort()).toEqual(players);
    }
  });

  it("同じプレイヤーが2回いたら GameRuleError", () => {
    expect(() => drawSeats(["a", "a"], rules, createRng(1))).toThrow(GameRuleError);
  });
});
