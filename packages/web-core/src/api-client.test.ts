import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, createApiClient } from "./api-client.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(response: Response | Promise<Response>, options = {}) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(Promise.resolve(response));
  const client = createApiClient({ fetch, ...options });
  return { fetch, client };
}

function sentRequest(fetch: ReturnType<typeof setup>["fetch"]) {
  const [url, init] = fetch.mock.calls[0]!;
  return { url, init: init!, headers: new Headers(init!.headers) };
}

describe("createApiClient().request", () => {
  it("レスポンスの JSON を返す", async () => {
    const { client } = setup(jsonResponse({ status: "ok" }));

    await expect(client.request("/api/health")).resolves.toEqual({ status: "ok" });
  });

  it("baseUrl をパスの前に付ける", async () => {
    const { fetch, client } = setup(jsonResponse({}), { baseUrl: "https://api.example.com" });

    await client.request("/api/health");

    expect(sentRequest(fetch).url).toBe("https://api.example.com/api/health");
  });

  it("body を JSON にして送り、Content-Type を付ける", async () => {
    const { fetch, client } = setup(jsonResponse({}, 201));

    await client.request("/api/rooms", { method: "POST", body: { name: "Alice" } });

    const { init, headers } = sentRequest(fetch);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Alice" }));
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("body が無ければ Content-Type を付けない", async () => {
    const { fetch, client } = setup(jsonResponse({}));

    await client.request("/api/health");

    const { init, headers } = sentRequest(fetch);
    expect(init.method).toBe("GET");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("getToken が返したトークンを Bearer で付ける", async () => {
    const { fetch, client } = setup(jsonResponse({}), { getToken: () => "t-1" });

    await client.request("/api/me");

    expect(sentRequest(fetch).headers.get("Authorization")).toBe("Bearer t-1");
  });

  it("呼び出しごとに渡したトークンを優先する", async () => {
    const { fetch, client } = setup(jsonResponse({}), { getToken: () => "t-1" });

    await client.request("/api/rooms/ABC", { token: "room-token" });

    expect(sentRequest(fetch).headers.get("Authorization")).toBe("Bearer room-token");
  });

  it("トークンが無ければ Authorization を付けない", async () => {
    const { fetch, client } = setup(jsonResponse({}), { getToken: () => null });

    await client.request("/api/health");

    expect(sentRequest(fetch).headers.has("Authorization")).toBe(false);
  });

  it("204 は undefined を返す", async () => {
    const { client } = setup(new Response(null, { status: 204 }));

    await expect(client.request("/api/items/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("エラーはサーバーの code と message を持つ ApiRequestError にする", async () => {
    const { client } = setup(
      jsonResponse({ error: { code: "ROOM_NOT_FOUND", message: "ルームが無い" } }, 404)
    );

    const error = await client.request("/api/rooms/X").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 404, code: "ROOM_NOT_FOUND", message: "ルームが無い" });
  });

  it("エラー本文が読めなくても（502 で HTML 等）ステータス付きで失敗する", async () => {
    const { client } = setup(new Response("<html>Bad Gateway</html>", { status: 502 }));

    await expect(client.request("/api/health")).rejects.toMatchObject({
      status: 502,
      code: "HTTP_502",
      message: "通信に失敗した",
    });
  });

  it("サーバーへ届かなければ status 0 の NETWORK_ERROR にする", async () => {
    const { client } = setup(Promise.reject(new TypeError("Failed to fetch")));

    await expect(client.request("/api/health")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("401 のときは onUnauthorized を呼んでから失敗する", async () => {
    const onUnauthorized = vi.fn();
    const { client } = setup(jsonResponse({ error: { code: "UNAUTHORIZED", message: "x" } }, 401), {
      onUnauthorized,
    });

    await expect(client.request("/api/me")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("fetch を渡さなければグローバルの fetch を使う", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(createApiClient().request("/api/health")).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
