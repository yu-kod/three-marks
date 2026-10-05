import { describe, expect, it, vi } from "vitest";
import { createTableApi } from "./table-api";
import { buildGameView, buildRoom } from "@/test-utils/table";

describe("createTableApi", () => {
  it("ルームとゲームを取り、包みを外して返す（ID は URL に入る形にする）", async () => {
    const request = vi.fn(async (path: string) =>
      path.endsWith("/game") ? { game: buildGameView() } : { room: buildRoom() }
    );
    const api = createTableApi({ request } as never);

    await expect(api.getRoom("a/b")).resolves.toEqual(buildRoom());
    await expect(api.getGame("a/b")).resolves.toEqual(buildGameView());
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/api/rooms/a%2Fb",
      "/api/rooms/a%2Fb/game",
    ]);
  });
});
