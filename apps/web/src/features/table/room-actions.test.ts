import { ApiRequestError } from "@app/web-core";
import { describe, expect, it, vi } from "vitest";
import { createRoom, createRoomActions } from "./room-actions";
import { buildRoom } from "@/test-utils/table";

const guest = { kind: "guest" as const, id: "g1", name: "あなた" };

function setup(request = vi.fn(async () => ({ room: buildRoom() }))) {
  const ensureGuest = vi.fn(async () => guest);
  const refresh = vi.fn();
  const actions = createRoomActions({
    client: { request } as never,
    ensureGuest,
    roomId: "r/1",
    refresh,
  });
  return { actions, request, ensureGuest, refresh };
}

describe("createRoomActions", () => {
  it("参加する：まだゲストでなければゲストになってから席に着き、すぐ取り直す", async () => {
    const { actions, request, ensureGuest, refresh } = setup();

    await expect(actions.join()).resolves.toEqual({ ok: true });

    expect(ensureGuest).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("/api/rooms/r%2F1/join", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
  });

  it("席を離れる", async () => {
    const { actions, request, refresh } = setup();

    await expect(actions.leave()).resolves.toEqual({ ok: true });

    expect(request).toHaveBeenCalledWith("/api/rooms/r%2F1/leave", { method: "POST" });
    expect(refresh).toHaveBeenCalled();
  });

  it("失敗したら、画面に出す言葉で返す（満員などはサーバーの言葉、通信の失敗はそれと分かる言葉）", async () => {
    const full = setup(
      vi.fn().mockRejectedValue(new ApiRequestError(422, "ROOM_FULL", "ルームは満員（4人まで）"))
    );
    const broken = setup(vi.fn().mockRejectedValue(new TypeError("壊れた")));

    await expect(full.actions.join()).resolves.toEqual({
      ok: false,
      message: "ルームは満員（4人まで）",
    });
    await expect(broken.actions.join()).resolves.toEqual({
      ok: false,
      message: "うまくいきませんでした。もう一度試してください",
    });
    expect(full.refresh).not.toHaveBeenCalled();
  });
});

describe("createRoom", () => {
  it("ゲストになってからルームを作り、その ID を返す", async () => {
    const request = vi.fn(async () => ({ room: buildRoom({ id: "new-room" }) }));
    const ensureGuest = vi.fn(async () => guest);

    await expect(createRoom({ client: { request } as never, ensureGuest })).resolves.toEqual({
      ok: true,
      roomId: "new-room",
    });
    expect(request).toHaveBeenCalledWith("/api/rooms", { method: "POST" });
  });

  it("作れなければ、画面に出す言葉で返す", async () => {
    const ensureGuest = vi
      .fn()
      .mockRejectedValue(new ApiRequestError(0, "NETWORK_ERROR", "サーバーに接続できない"));

    await expect(
      createRoom({ client: { request: vi.fn() } as never, ensureGuest })
    ).resolves.toEqual({
      ok: false,
      message: "サーバーに接続できない",
    });
  });
});
