import { describe, expect, it } from "vitest";
import { GUEST_NAME_MAX_LENGTH } from "./guest-routes.js";
import { ANIMALS, ADJECTIVES, generateGuestName } from "./guest-name.js";

/** 渡した値を順に返す乱数（0 以上 1 未満） */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("generateGuestName", () => {
  it("形容詞と動物を乱数で選んでつなげる", () => {
    expect(generateGuestName(sequence(0, 0))).toBe(`${ADJECTIVES[0]}${ANIMALS[0]}`);
  });

  it("乱数が 1 に近くても最後の要素を選び、範囲の外へ出ない", () => {
    expect(generateGuestName(sequence(0.9999, 0.9999))).toBe(
      `${ADJECTIVES.at(-1)}${ANIMALS.at(-1)}`
    );
  });

  it("どの組み合わせも名前の上限に収まる", () => {
    for (const adjective of ADJECTIVES) {
      for (const animal of ANIMALS) {
        expect(`${adjective}${animal}`.length).toBeLessThanOrEqual(GUEST_NAME_MAX_LENGTH);
      }
    }
  });

  it("同じ名前ばかりにならない程度の組み合わせがある", () => {
    expect(ADJECTIVES.length * ANIMALS.length).toBeGreaterThanOrEqual(200);
  });

  it("乱数を渡さなくても名前を返す", () => {
    expect(generateGuestName()).toMatch(/^.+$/);
  });
});
