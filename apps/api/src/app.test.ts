import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryGuestStore } from "@app/identity";
import { createApp } from "./app.js";
import { testClient } from "./test-utils/client.js";

describe("createApp", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("GET /api/health が ok を返す", async () => {
    const res = await createApp().request("/api/health");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("未定義のパスは統一フォーマットの 404 を返す", async () => {
    const res = await createApp().request("/api/does-not-exist");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "GET /api/does-not-exist は存在しない" },
    });
  });

  it("ゲストを登録し、発行されたトークンで自分を取得できる", async () => {
    const app = createApp({ guestStore: createInMemoryGuestStore() });

    const created = await app.request("/api/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice" }),
    });
    const { token } = (await created.json()) as { token: string };
    const me = await app.request("/api/guests/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(created.status).toBe(201);
    await expect(me.json()).resolves.toMatchObject({ guest: { kind: "guest", name: "Alice" } });
  });

  it("すべてのリクエストを構造化ログに残す", async () => {
    await createApp().request("/api/health");

    const logged = JSON.parse(vi.mocked(console.info).mock.calls[0]?.[0] as string);
    expect(logged).toMatchObject({ path: "/api/health", status: 200 });
  });

  it("ルームが変わったら通知する（WebSocket）", async () => {
    const roomChanged = vi.fn(async () => {});
    const client = testClient({ notifier: { roomChanged } });
    const alice = await client.guest("Alice");
    const bob = await client.guest("Bob");
    const { body } = await client.request("POST", "/api/rooms", { token: alice.token });

    await client.request("POST", `/api/rooms/${body.room.id}/join`, { token: bob.token });

    expect(roomChanged).toHaveBeenCalledWith(body.room.id);
  });
});
