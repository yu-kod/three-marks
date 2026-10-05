import { describe, expect, it } from "vitest";
import { cardFaceOf } from "./card-face";

describe("cardFaceOf", () => {
  it("数字の札は数字の面、ブルはブルの印の面", () => {
    expect(cardFaceOf(15)).toEqual({ kind: "number", value: 15 });
    expect(cardFaceOf("bull")).toEqual({ kind: "bull" });
  });
});
