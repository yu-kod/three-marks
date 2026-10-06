import { describe, expect, it } from "vitest";
import { autoNotice } from "./auto-notice";

describe("autoNotice", () => {
  it("サーバーが代わりに進めた投げなら、誰の投げかが分かる一言を出す", () => {
    expect(autoNotice({ auto: true }, "ペンギン", false)).toBe(
      "ペンギン の時間切れ。代わりに投げました"
    );
    expect(autoNotice({ auto: true }, "ペンギン", true)).toBe("時間切れ。代わりに投げました");
  });

  it("自分で投げた投げには出さない", () => {
    expect(autoNotice({}, "ペンギン", false)).toBeNull();
  });
});
