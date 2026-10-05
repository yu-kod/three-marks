import { describe, expect, it } from "vitest";
import { createRng, shuffle, type Rng } from "./rng.js";

describe("createRng", () => {
  it("同じシードなら同じ並びを返す（ゲームを再現できる）", () => {
    const a = createRng(7);
    const b = createRng(7);

    expect(Array.from({ length: 20 }, () => a.nextInt(100))).toEqual(
      Array.from({ length: 20 }, () => b.nextInt(100))
    );
  });

  it("違うシードなら違う並びになる", () => {
    const a = createRng(1);
    const b = createRng(2);

    expect(Array.from({ length: 20 }, () => a.nextInt(1000))).not.toEqual(
      Array.from({ length: 20 }, () => b.nextInt(1000))
    );
  });

  it("nextInt(n) は 0 以上 n 未満の整数で、偏りが小さい", () => {
    const rng = createRng(123);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) {
      const value = rng.nextInt(4);
      expect(Number.isInteger(value)).toBe(true);
      counts[value]!++;
    }

    // 期待値 10000 から 3% 以内
    for (const count of counts) {
      expect(Math.abs(count - 10_000)).toBeLessThan(300);
    }
  });

  it("下位ビットも偏らない（2択を繰り返しても片方に寄らない）", () => {
    const rng = createRng(42);
    const heads = Array.from({ length: 10_000 }, () => rng.nextInt(2)).filter((v) => v === 1);

    expect(Math.abs(heads.length - 5_000)).toBeLessThan(250);
  });
});

describe("shuffle", () => {
  /** 渡した値を順に返す乱数 */
  function sequence(...values: number[]): Rng {
    let i = 0;
    return { nextInt: () => values[i++]! };
  }

  it("Fisher–Yates で並べ替える（後ろから順に、選ばれた位置と入れ替える）", () => {
    // i=2: 0 と入れ替え → [c,b,a] / i=1: 1 と入れ替え（そのまま）
    expect(shuffle(["a", "b", "c"], sequence(0, 1))).toEqual(["c", "b", "a"]);
  });

  it("元の配列は書き換えず、同じ要素をすべて含む", () => {
    const items = [1, 2, 3, 4, 5];

    const shuffled = shuffle(items, createRng(9));

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
