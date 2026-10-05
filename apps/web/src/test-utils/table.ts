import type { GameView } from "@three-marks/engine";
import type { RoomView } from "@/game/state/types";

export function buildRoom(overrides: Partial<RoomView> = {}): RoomView {
  return {
    id: "r1",
    hostId: "g1",
    members: [{ id: "g1", name: "あなた", cpu: false }],
    maxPlayers: 4,
    seatDraw: null,
    status: "waiting",
    ...overrides,
  };
}

/** 中身は描画の側で見るだけなので、ストアのテストには形が合っていればよい */
export function buildGameView(overrides: Partial<GameView> = {}): GameView {
  return { round: 1, ...overrides } as GameView;
}
