import { describe, expect, it } from "vitest";
import { glyphBox } from "./card-layout";

const card = { width: 44, height: 112, radius: 2 };

describe("glyphBox", () => {
  it("決めていなければ、数字はカードの真ん中に幅86%・高さ40%、ブルは幅80%の正方形", () => {
    expect(glyphBox(card, "number")).toEqual({ y: 0, width: 44 * 0.86, height: 112 * 0.4 });
    expect(glyphBox(card, "bull")).toEqual({ y: 0, width: 44 * 0.8, height: 44 * 0.8 });
  });

  it("スキンが決めたら、数字もブルもその枠（カードに対する割合）に置く", () => {
    const full = { ...card, glyph: { width: 1, height: 1, y: 0 } };
    expect(glyphBox(full, "number")).toEqual({ y: 0, width: 44, height: 112 });
    expect(glyphBox(full, "bull")).toEqual({ y: 0, width: 44, height: 112 });

    const top = { ...card, glyph: { width: 0.9, height: 0.5, y: -0.2 } };
    expect(glyphBox(top, "number")).toEqual({ y: 112 * -0.2, width: 44 * 0.9, height: 112 * 0.5 });
  });
});
