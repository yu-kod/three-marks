import { describe, expect, it } from "vitest";
import { lobbyButtons, lobbyView } from "./lobby";
import { createGame, createRng, viewFor } from "@three-marks/engine";
import { gameModel } from "./game-model";
import { roomModel } from "./room-model";
import { seatDrawRounds } from "./seat-draw";
import { buildRoom } from "@/test-utils/table";

describe("roomModel", () => {
  it("読み込み中・エラー・ゲーム中・待合室を見分ける（見出しはどれにも付ける）", () => {
    const room = buildRoom();

    expect(roomModel({ status: "loading" }, null)).toEqual({
      kind: "loading",
      headline: "読み込み中…",
    });
    expect(roomModel({ status: "error", code: "ROOM_NOT_FOUND" }, null)).toEqual({
      kind: "error",
      headline: "ルームが見つかりません",
    });
    const playing = buildRoom({
      status: "playing",
      members: [
        { id: "a", name: "A", cpu: false },
        { id: "b", name: "B", cpu: false },
      ],
    });
    const game = viewFor(createGame(["a", "b"], createRng(1)), "a");
    expect(roomModel({ status: "ready", room: playing, game }, "a")).toEqual({
      kind: "game",
      headline: "ROUND 1",
      game: gameModel(playing, game, "a"),
    });
    expect(roomModel({ status: "ready", room, game: null }, "g1")).toEqual({
      kind: "lobby",
      headline: "待合室 1 / 4 人",
      view: lobbyView(room, "g1"),
      buttons: lobbyButtons(lobbyView(room, "g1")),
      seatDraw: seatDrawRounds(room),
    });
  });

  it("同じ状態からは同じ形ができる（描き直すかどうかを比べられる）", () => {
    const state = { status: "ready" as const, room: buildRoom(), game: null };

    expect(JSON.stringify(roomModel(state, "g1"))).toBe(
      JSON.stringify(roomModel({ ...state }, "g1"))
    );
  });
});
