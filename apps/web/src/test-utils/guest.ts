import { createGuestSession, GUEST_TOKEN_KEY, type Guest } from "@app/identity-client";
import { createJsonStorage, type ApiClient, type RequestOptions } from "@app/web-core";
import { vi } from "vitest";

export const penguin: Guest = { kind: "guest", id: "g-1", name: "ねむいペンギン" };

/** "METHOD /path" ごとの応答。投げればそのリクエストは失敗する */
export type GuestRoutes = Record<string, (body: unknown) => unknown>;

/**
 * 本物のゲストセッションを、偽の API につないで作る。
 *
 * セッションの振る舞い（状態の移り変わり、同時登録の抑止など）はそのまま使い、
 * サーバーとのやりとりだけを差し替える。
 */
export function guestSessionWith(routes: GuestRoutes, { token }: { token?: string } = {}) {
  if (token) {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify(token));
  }
  const request = vi.fn(async (path: string, init: RequestOptions = {}) => {
    const route = routes[`${init.method ?? "GET"} ${path}`];
    if (!route) throw new Error(`unexpected request: ${init.method ?? "GET"} ${path}`);
    return route(init.body);
  });
  const session = createGuestSession({
    api: { request } as ApiClient,
    storage: createJsonStorage(),
  });
  /** 指定したリクエストで送ったボディの一覧 */
  const sent = (route: string) =>
    request.mock.calls
      .filter(([path, init]) => `${init?.method ?? "GET"} ${path}` === route)
      .map(([, init]) => init?.body);
  return { session, request, sent };
}

/** 初めて来た人。ensure() すると penguin として登録される */
export function newcomer(overrides: GuestRoutes = {}) {
  return guestSessionWith({
    "POST /api/guests": () => ({ guest: penguin, token: "t-new" }),
    ...overrides,
  });
}

/** 前に来たことがある人。名前の変更もそのまま通る */
export function returning(guest: Guest = penguin, overrides: GuestRoutes = {}) {
  return guestSessionWith(
    {
      "GET /api/guests/me": () => ({ guest }),
      "PATCH /api/guests/me": (body) => ({ guest: { ...guest, ...(body as { name: string }) } }),
      ...overrides,
    },
    { token: "t-1" }
  );
}
