import { GUEST_TOKEN_KEY } from "@app/identity-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("api", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function stubFetch() {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    return () => new Headers(fetch.mock.calls[0]![1]!.headers).get("Authorization");
  }

  it("このブラウザのゲストのトークンを付けて送る", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const authorization = stubFetch();

    await api.request("/api/anything");

    expect(authorization()).toBe("Bearer t-1");
  });

  it("まだゲストでなければトークンを付けない", async () => {
    const authorization = stubFetch();

    await api.request("/api/anything");

    expect(authorization()).toBeNull();
  });
});
