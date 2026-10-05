import { ApiRequestError, createJsonStorage, type ApiClient } from "@app/web-core";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGuestSession, GUEST_TOKEN_KEY, type Guest } from "./guest-session.js";
import { GuestProvider, useGuest } from "./react.js";

const alice: Guest = { kind: "guest", id: "g-1", name: "ねむいペンギン" };

/** method と path で応答を返す偽の API。関数が投げればそのまま失敗する */
function fakeApi(routes: Record<string, () => unknown>): ApiClient {
  return {
    request: vi.fn(async (path: string, init: { method?: string } = {}) => {
      const route = routes[`${init.method ?? "GET"} ${path}`];
      if (!route) throw new Error(`unexpected request: ${init.method} ${path}`);
      return route();
    }) as ApiClient["request"],
  };
}

function render(routes: Record<string, () => unknown>) {
  const session = createGuestSession({ api: fakeApi(routes), storage: createJsonStorage() });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GuestProvider session={session}>{children}</GuestProvider>
  );
  return { session, ...renderHook(() => useGuest(), { wrapper }) };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useGuest", () => {
  it("表示したら前回のゲストを読み込み、ready になる", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { result } = render({ "GET /api/guests/me": () => ({ guest: alice }) });

    await waitFor(() => expect(result.current).toMatchObject({ status: "ready", guest: alice }));
  });

  it("まだゲストでなければ anonymous", async () => {
    const { result } = render({});

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
  });

  it("読み込みに失敗しても例外にせず error で知らせる", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { result } = render({
      "GET /api/guests/me": () => {
        throw new ApiRequestError(503, "HTTP_503", "down");
      },
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("ensureGuest で登録して ready になる", async () => {
    const { result } = render({ "POST /api/guests": () => ({ guest: alice, token: "t" }) });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));

    await act(() => result.current.ensureGuest());

    expect(result.current).toMatchObject({ status: "ready", guest: alice });
  });

  it("rename で名前が変わる", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { result } = render({
      "GET /api/guests/me": () => ({ guest: alice }),
      "PATCH /api/guests/me": () => ({ guest: { ...alice, name: "ゆう" } }),
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(() => result.current.rename("ゆう"));

    expect(result.current.guest?.name).toBe("ゆう");
  });

  it("React の外（ゲームのシーンなど）で起きた変化も反映する", async () => {
    const { result, session } = render({
      "POST /api/guests": () => ({ guest: alice, token: "t" }),
    });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));

    await act(() => session.ensure());

    expect(result.current.status).toBe("ready");
  });

  it("GuestProvider の外で使うと分かりやすく失敗する", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useGuest())).toThrow("GuestProvider");
  });
});
