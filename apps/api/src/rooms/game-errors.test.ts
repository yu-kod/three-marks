import { UnprocessableError } from "@app/server-core";
import { GameRuleError } from "@three-marks/engine";
import { describe, expect, it } from "vitest";
import { withGameRules } from "./game-errors.js";

describe("withGameRules", () => {
  it("エンジンの結果をそのまま返す", () => {
    expect(withGameRules(() => 42)).toBe(42);
  });

  it("ルール違反（GameRuleError）は 422 の GAME_RULE にして、メッセージを残す", () => {
    const run = () =>
      withGameRules(() => {
        throw new GameRuleError("g-2 の手番ではない");
      });

    expect(run).toThrow(UnprocessableError);
    expect(run).toThrow(
      expect.objectContaining({ code: "GAME_RULE", message: "g-2 の手番ではない" })
    );
  });

  it("それ以外の失敗（エンジンの不具合）はそのまま投げて 500 にする", () => {
    const bug = new TypeError("bug");

    expect(() =>
      withGameRules(() => {
        throw bug;
      })
    ).toThrow(bug);
  });
});
