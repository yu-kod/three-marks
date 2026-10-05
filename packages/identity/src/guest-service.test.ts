import { UnauthorizedError } from "@app/server-core";
import { describe, expect, it } from "vitest";
import { createInMemoryGuestStore } from "./guest-store.js";
import { createGuestService, GUEST_TTL_SECONDS } from "./guest-service.js";
import { hashToken } from "./token.js";

const DAY = 24 * 60 * 60;
const START = 1_700_000_000; // UNIX 秒

function setup() {
  const store = createInMemoryGuestStore();
  let nowSeconds = START;
  let seq = 0;
  const service = createGuestService({
    store,
    now: () => nowSeconds * 1000,
    generateToken: () => `token-${++seq}`,
    generateId: () => `guest-${seq}`,
  });
  return {
    store,
    service,
    advance(seconds: number) {
      nowSeconds += seconds;
    },
  };
}

describe("register", () => {
  it("ゲストを作り、トークンを一度だけ返す", async () => {
    const { service } = setup();

    await expect(service.register("Alice")).resolves.toEqual({
      guest: { kind: "guest", id: "guest-1", name: "Alice" },
      token: "token-1",
    });
  });

  it("保存するのはトークンのハッシュだけで、期限は 30 日後", async () => {
    const { service, store } = setup();

    await service.register("Alice");

    expect(GUEST_TTL_SECONDS).toBe(30 * DAY);
    await expect(store.findByTokenHash(hashToken("token-1"))).resolves.toEqual({
      tokenHash: hashToken("token-1"),
      guestId: "guest-1",
      name: "Alice",
      createdAt: START,
      expiresAt: START + 30 * DAY,
    });
  });
});

describe("authenticate", () => {
  it("発行したトークンでゲストが分かる", async () => {
    const { service } = setup();
    const { token } = await service.register("Alice");

    await expect(service.authenticate(token)).resolves.toEqual({
      kind: "guest",
      id: "guest-1",
      name: "Alice",
    });
  });

  it("知らないトークンは null", async () => {
    await expect(setup().service.authenticate("forged")).resolves.toBeNull();
  });

  it("期限ちょうどで無効になる（TTL の削除が遅れていても通さない）", async () => {
    const { service, advance } = setup();
    const { token } = await service.register("Alice");

    advance(30 * DAY - 1);
    await expect(service.authenticate(token)).resolves.not.toBeNull();

    const { service: fresh, advance: advanceFresh } = setup();
    const { token: freshToken } = await fresh.register("Bob");
    advanceFresh(30 * DAY);
    await expect(fresh.authenticate(freshToken)).resolves.toBeNull();
  });

  it("残りが半分（15 日）を切ってから使われたら、期限を 30 日後へ延ばす", async () => {
    const { service, store, advance } = setup();
    const { token } = await service.register("Alice");

    advance(15 * DAY + 1);
    await service.authenticate(token);

    await expect(store.findByTokenHash(hashToken(token))).resolves.toMatchObject({
      expiresAt: START + 15 * DAY + 1 + 30 * DAY,
    });
  });

  it("残りが半分以上なら書き込まない（認証のたびに書き込み費用をかけない）", async () => {
    const { service, store, advance } = setup();
    const { token } = await service.register("Alice");

    advance(15 * DAY);
    await service.authenticate(token);

    await expect(store.findByTokenHash(hashToken(token))).resolves.toMatchObject({
      expiresAt: START + 30 * DAY,
    });
  });
});

describe("rename", () => {
  it("名前を変えて、変えた後のゲストを返す", async () => {
    const { service } = setup();
    const { token } = await service.register("Alice");

    await expect(service.rename(token, "Alicia")).resolves.toEqual({
      kind: "guest",
      id: "guest-1",
      name: "Alicia",
    });
    await expect(service.authenticate(token)).resolves.toMatchObject({ name: "Alicia" });
  });

  it("無効なトークンでは UnauthorizedError", async () => {
    await expect(setup().service.rename("forged", "Mallory")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });
});

describe("既定の依存", () => {
  it("時刻・トークン・ID を渡さなくても動く", async () => {
    const service = createGuestService({ store: createInMemoryGuestStore() });

    const { guest, token } = await service.register("Alice");

    expect(guest.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(service.authenticate(token)).resolves.toEqual(guest);
  });
});
