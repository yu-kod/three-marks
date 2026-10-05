import { describe, expect, it } from "vitest";
import { tableHeadline } from "./headline";
import { buildGameView, buildRoom } from "@/test-utils/table";

describe("tableHeadline", () => {
  it("読み込みの間とエラー", () => {
    expect(tableHeadline({ status: "loading" })).toBe("読み込み中…");
    expect(tableHeadline({ status: "error", code: "ROOM_NOT_FOUND" })).toBe(
      "ルームが見つかりません"
    );
    expect(tableHeadline({ status: "error", code: "NETWORK_ERROR" })).toBe("読み込めませんでした");
  });

  it("待合室では集まった人数、ゲーム中はラウンド、終われば終了", () => {
    const room = buildRoom();
    expect(tableHeadline({ status: "ready", room, game: null })).toBe("待合室 1 / 4 人");
    expect(
      tableHeadline({
        status: "ready",
        room: buildRoom({ status: "playing" }),
        game: buildGameView({ round: 3 }),
      })
    ).toBe("ROUND 3");
    expect(
      tableHeadline({
        status: "ready",
        room: buildRoom({ status: "finished" }),
        game: buildGameView({ round: 9 }),
      })
    ).toBe("GAME OVER");
  });
});
