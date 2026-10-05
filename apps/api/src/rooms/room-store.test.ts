import { ConflictError } from "@app/server-core";
import { describe, expect, it } from "vitest";
import { createInMemoryRoomStore, type RoomRecord } from "./room-store.js";

function buildRoom(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return {
    roomId: "room-1",
    hostId: "g-1",
    members: [{ guestId: "g-1", name: "Alice", joinedAt: 1_000 }],
    createdAt: 1_000,
    expiresAt: 2_000,
    seatDraw: null,
    game: null,
    version: 1,
    ...overrides,
  };
}

describe("createInMemoryRoomStore", () => {
  it("作ったルームを ID で引ける", async () => {
    const store = createInMemoryRoomStore();
    await store.create(buildRoom());

    await expect(store.find("room-1")).resolves.toEqual(buildRoom());
  });

  it("無い ID は null", async () => {
    await expect(createInMemoryRoomStore().find("nope")).resolves.toBeNull();
  });

  it("同じ ID で2度作ろうとしたら ConflictError（上書きしない）", async () => {
    const store = createInMemoryRoomStore();
    await store.create(buildRoom());

    await expect(store.create(buildRoom({ hostId: "g-2" }))).rejects.toBeInstanceOf(ConflictError);
    await expect(store.find("room-1")).resolves.toMatchObject({ hostId: "g-1" });
  });

  it("save は読んだときの版のままなら書き込み、版を1つ進める", async () => {
    const store = createInMemoryRoomStore();
    await store.create(buildRoom());
    const members = [
      { guestId: "g-1", name: "Alice", joinedAt: 1_000 },
      { guestId: "g-2", name: "Bob", joinedAt: 1_500 },
    ];

    await store.save(buildRoom({ members }));

    await expect(store.find("room-1")).resolves.toEqual(buildRoom({ members, version: 2 }));
  });

  it("他の誰かが先に書き込んでいたら（版が違えば）ConflictError で、上書きしない", async () => {
    const store = createInMemoryRoomStore();
    await store.create(buildRoom());
    await store.save(buildRoom({ hostId: "first" }));

    await expect(store.save(buildRoom({ hostId: "second" }))).rejects.toBeInstanceOf(ConflictError);
    await expect(store.find("room-1")).resolves.toMatchObject({ hostId: "first", version: 2 });
  });

  it("無いルームの save は ConflictError（消えたルームを復活させない）", async () => {
    await expect(createInMemoryRoomStore().save(buildRoom())).rejects.toBeInstanceOf(ConflictError);
  });

  it("返した値を書き換えても保存内容は変わらない", async () => {
    const store = createInMemoryRoomStore();
    await store.create(buildRoom());

    const found = await store.find("room-1");
    found!.members.push({ guestId: "x", name: "x", joinedAt: 0 });

    await expect(store.find("room-1")).resolves.toEqual(buildRoom());
  });
});
