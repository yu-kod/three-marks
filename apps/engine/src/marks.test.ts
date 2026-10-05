import { describe, expect, it } from "vitest";
import {
  addMarks,
  deadTargets,
  emptyMarks,
  hasOpenedAll,
  MARKS_TO_OPEN,
  openedTargets,
  type Marks,
} from "./marks.js";
import { TARGETS } from "./targets.js";

function marks(overrides: Partial<Marks> = {}): Marks {
  return { ...emptyMarks(), ...overrides };
}

const allOpen = (): Marks => Object.fromEntries(TARGETS.map((t) => [t, 3])) as Marks;

describe("emptyMarks", () => {
  it("7つの数字すべてが 0 マークから始まる", () => {
    expect(emptyMarks()).toEqual({ 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, bull: 0 });
  });
});

describe("addMarks", () => {
  it("当たった数字ごとに1マーク足す", () => {
    expect(addMarks(marks(), [18, 18, 20])).toEqual(marks({ 18: 2, 20: 1 }));
  });

  it("3マークで止まり、超過分は捨てる（5章）", () => {
    expect(addMarks(marks({ bull: 2 }), ["bull", "bull", "bull"])).toEqual(marks({ bull: 3 }));
  });

  it("元のマークは書き換えない", () => {
    const before = marks({ 15: 1 });

    addMarks(before, [15]);

    expect(before[15]).toBe(1);
  });
});

describe("openedTargets", () => {
  it(`${MARKS_TO_OPEN} マークたまった数字がオープン`, () => {
    expect(openedTargets(marks({ 15: 3, 16: 2, bull: 3 }))).toEqual(new Set([15, "bull"]));
  });
});

describe("deadTargets", () => {
  it("全員がオープンした数字だけが死に番", () => {
    const players = [marks({ 20: 3, 19: 3 }), marks({ 20: 3, 19: 2 }), marks({ 20: 3 })];

    expect(deadTargets(players)).toEqual(new Set([20]));
  });

  it("誰もいなければ死に番もない", () => {
    expect(deadTargets([])).toEqual(new Set());
  });
});

describe("hasOpenedAll", () => {
  it("7つすべてをオープンしたら上がり（6章）", () => {
    expect(hasOpenedAll(allOpen())).toBe(true);
  });

  it("1つでも足りなければまだ", () => {
    expect(hasOpenedAll({ ...allOpen(), 15: 2 })).toBe(false);
  });
});
