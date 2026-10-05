import { ConflictError, NotFoundError } from "@app/server-core";
import { describe, expect, it } from "vitest";
import { createInMemoryGuestStore, type GuestRecord } from "./guest-store.js";

function buildRecord(overrides: Partial<GuestRecord> = {}): GuestRecord {
  return {
    tokenHash: "hash-1",
    guestId: "g-1",
    name: "Alice",
    createdAt: 1_000,
    expiresAt: 2_000,
    ...overrides,
  };
}

describe("createInMemoryGuestStore", () => {
  it("作ったゲストをトークンのハッシュで引ける", async () => {
    const store = createInMemoryGuestStore();
    await store.create(buildRecord());

    await expect(store.findByTokenHash("hash-1")).resolves.toEqual(buildRecord());
  });

  it("無いハッシュは null", async () => {
    await expect(createInMemoryGuestStore().findByTokenHash("nope")).resolves.toBeNull();
  });

  it("同じハッシュで2度作ろうとしたら ConflictError（上書きしない）", async () => {
    const store = createInMemoryGuestStore();
    await store.create(buildRecord());

    await expect(store.create(buildRecord({ name: "Mallory" }))).rejects.toBeInstanceOf(
      ConflictError
    );
    await expect(store.findByTokenHash("hash-1")).resolves.toMatchObject({ name: "Alice" });
  });

  it("update は渡した項目だけを書き換える", async () => {
    const store = createInMemoryGuestStore();
    await store.create(buildRecord());

    await store.update("hash-1", { expiresAt: 3_000 });
    await store.update("hash-1", { name: "Bob" });

    await expect(store.findByTokenHash("hash-1")).resolves.toEqual(
      buildRecord({ name: "Bob", expiresAt: 3_000 })
    );
  });

  it("存在しないゲストの update は NotFoundError（消えたゲストを復活させない）", async () => {
    await expect(
      createInMemoryGuestStore().update("hash-1", { name: "Bob" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("返した値を書き換えても保存内容は変わらない", async () => {
    const store = createInMemoryGuestStore();
    await store.create(buildRecord());

    const found = await store.findByTokenHash("hash-1");
    found!.name = "changed";

    await expect(store.findByTokenHash("hash-1")).resolves.toMatchObject({ name: "Alice" });
  });
});
