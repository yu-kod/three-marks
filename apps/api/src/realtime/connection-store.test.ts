import { describe, expect, it } from "vitest";
import { createInMemoryConnectionStore } from "./connection-store.js";

describe("createInMemoryConnectionStore", () => {
  it("ルームごとに接続を覚えて、ルームの接続を一覧できる", async () => {
    const store = createInMemoryConnectionStore();
    await store.add({ connectionId: "c1", roomId: "r1", expiresAt: 100 });
    await store.add({ connectionId: "c2", roomId: "r1", expiresAt: 100 });
    await store.add({ connectionId: "c3", roomId: "r2", expiresAt: 100 });

    await expect(store.listByRoom("r1")).resolves.toEqual(["c1", "c2"]);
    await expect(store.listByRoom("r9")).resolves.toEqual([]);
  });

  it("接続 ID だけで外せる（切断のときはルームが分からない）", async () => {
    const store = createInMemoryConnectionStore();
    await store.add({ connectionId: "c1", roomId: "r1", expiresAt: 100 });
    await store.add({ connectionId: "c2", roomId: "r1", expiresAt: 100 });

    await store.remove("c1");

    await expect(store.listByRoom("r1")).resolves.toEqual(["c2"]);
  });

  it("知らない接続を外しても何も起きない（切断の通知が2回来ても大丈夫）", async () => {
    await expect(createInMemoryConnectionStore().remove("nope")).resolves.toBeUndefined();
  });
});
