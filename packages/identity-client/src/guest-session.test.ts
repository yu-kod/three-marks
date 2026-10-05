import { createApiClient, createJsonStorage } from "@app/web-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGuestSession, GUEST_TOKEN_KEY, type Guest } from "./guest-session.js";

const alice: Guest = { kind: "guest", id: "g-1", name: "ねむいペンギン" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** 届いたリクエストを method と path で振り分ける偽のサーバー */
function setup(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init = {}) => {
    const handler = routes[`${init.method ?? "GET"} ${url}`];
    if (!handler) throw new Error(`unexpected request: ${init.method} ${url}`);
    return handler(init);
  });
  const storage = createJsonStorage();
  const session = createGuestSession({ api: createApiClient({ fetch }), storage });
  const authorization = (i: number) =>
    new Headers(fetch.mock.calls[i]![1]!.headers).get("Authorization");
  return { fetch, storage, session, authorization };
}

beforeEach(() => {
  localStorage.clear();
});

describe("get", () => {
  it("トークンが無ければサーバーに問い合わせず null", async () => {
    const { session, fetch } = setup({});

    await expect(session.get()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("保存したトークンで自分を取ってくる", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session, authorization } = setup({
      "GET /api/guests/me": () => json({ guest: alice }),
    });

    await expect(session.get()).resolves.toEqual(alice);
    expect(authorization(0)).toBe("Bearer t-1");
  });

  it("2回目からは問い合わせない", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session, fetch } = setup({ "GET /api/guests/me": () => json({ guest: alice }) });

    await session.get();
    await session.get();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("トークンが失効していたら（401）捨てて null", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("expired"));
    const { session, storage } = setup({
      "GET /api/guests/me": () => json({ error: { code: "UNAUTHORIZED", message: "x" } }, 401),
    });

    await expect(session.get()).resolves.toBeNull();
    expect(storage.get(GUEST_TOKEN_KEY)).toBeNull();
  });

  it("通信に失敗したらトークンは捨てずに失敗を返し、次の get でやり直す", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    let fail = true;
    const { session, storage } = setup({
      "GET /api/guests/me": () => (fail ? json({}, 503) : json({ guest: alice })),
    });

    await expect(session.get()).rejects.toMatchObject({ status: 503 });
    expect(storage.get(GUEST_TOKEN_KEY)).toBe("t-1");

    fail = false;
    await expect(session.get()).resolves.toEqual(alice);
  });
});

describe("ensure", () => {
  it("まだゲストでなければ、名前を聞かずに登録してトークンを保存する", async () => {
    const { session, storage, fetch } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t-new" }, 201),
    });

    await expect(session.ensure()).resolves.toEqual(alice);
    expect(fetch.mock.calls[0]![1]!.body).toBe("{}");
    expect(storage.get(GUEST_TOKEN_KEY)).toBe("t-new");
  });

  it("すでにゲストなら登録しない", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session, fetch } = setup({ "GET /api/guests/me": () => json({ guest: alice }) });

    await expect(session.ensure()).resolves.toEqual(alice);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("同時に呼ばれても登録は1回だけ（ボタンの連打で別人が2人できない）", async () => {
    const { session, fetch } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t-new" }, 201),
    });

    const [a, b] = await Promise.all([session.ensure(), session.ensure()]);

    expect(a).toEqual(b);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("登録に失敗したら、次の ensure でやり直せる", async () => {
    let fail = true;
    const { session } = setup({
      "POST /api/guests": () => (fail ? json({}, 500) : json({ guest: alice, token: "t" }, 201)),
    });

    await expect(session.ensure()).rejects.toMatchObject({ status: 500 });
    fail = false;
    await expect(session.ensure()).resolves.toEqual(alice);
  });

  it("読み込みに失敗したら ensure も失敗する（別人として登録し直さない）。次の呼び出しでやり直す", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    let fail = true;
    const { session, fetch } = setup({
      "GET /api/guests/me": () => (fail ? json({}, 503) : json({ guest: alice })),
    });

    await expect(session.ensure()).rejects.toMatchObject({ status: 503 });
    expect(fetch.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);

    fail = false;
    await expect(session.ensure()).resolves.toEqual(alice);
  });

  it("登録後の get は登録したゲストを返す", async () => {
    const { session, fetch } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t-new" }, 201),
    });

    await session.ensure();

    await expect(session.get()).resolves.toEqual(alice);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("rename", () => {
  it("名前を変え、以後の get も新しい名前を返す", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const renamed = { ...alice, name: "Alice" };
    const { session, fetch, authorization } = setup({
      "GET /api/guests/me": () => json({ guest: alice }),
      "PATCH /api/guests/me": () => json({ guest: renamed }),
    });

    await expect(session.rename("Alice")).resolves.toEqual(renamed);
    await expect(session.get()).resolves.toEqual(renamed);
    const patch = fetch.mock.calls.findIndex(([, init]) => init?.method === "PATCH");
    expect(fetch.mock.calls[patch]![1]!.body).toBe(JSON.stringify({ name: "Alice" }));
    expect(authorization(patch)).toBe("Bearer t-1");
  });

  it("まだゲストでなければ、先に登録してから名前を変える", async () => {
    const renamed = { ...alice, name: "Alice" };
    const { session } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t-new" }, 201),
      "PATCH /api/guests/me": () => json({ guest: renamed }),
    });

    await expect(session.rename("Alice")).resolves.toEqual(renamed);
  });
});

describe("token", () => {
  it("他の API 呼び出しに付けるトークンを返す", async () => {
    const { session } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t-new" }, 201),
    });

    expect(session.token()).toBeNull();
    await session.ensure();
    expect(session.token()).toBe("t-new");
  });
});

describe("保存先の名前", () => {
  it("アプリごとに保存先のキーを変えられる", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json({ guest: alice, token: "t" }, 201)
    );
    const session = createGuestSession({
      api: createApiClient({ fetch }),
      storage: createJsonStorage(),
      storageKey: "three-marks:guest",
    });

    await session.ensure();

    expect(localStorage.getItem("three-marks:guest")).toBe(JSON.stringify("t"));
  });
});

describe("ensure(name)", () => {
  it("名前を渡すとその名前で登録する（ゲームのエントリー画面で選んだ名前など）", async () => {
    const { session, fetch } = setup({
      "POST /api/guests": (init) =>
        json({ guest: { ...alice, name: JSON.parse(String(init.body)).name }, token: "t" }, 201),
    });

    await expect(session.ensure("ゆう")).resolves.toMatchObject({ name: "ゆう" });
    expect(fetch.mock.calls[0]![1]!.body).toBe(JSON.stringify({ name: "ゆう" }));
  });

  it("すでにゲストなら、渡した名前に変える", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session } = setup({
      "GET /api/guests/me": () => json({ guest: alice }),
      "PATCH /api/guests/me": () => json({ guest: { ...alice, name: "ゆう" } }),
    });

    await expect(session.ensure("ゆう")).resolves.toMatchObject({ name: "ゆう" });
  });

  it("すでに同じ名前なら変更を送らない", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session, fetch } = setup({ "GET /api/guests/me": () => json({ guest: alice }) });

    await session.ensure(alice.name);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("状態（getState / subscribe）", () => {
  it("最初は idle", () => {
    expect(setup({}).session.getState()).toEqual({ status: "idle", guest: null });
  });

  it("読み込み中は loading、終わったら ready。変わるたびに購読者へ知らせる", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session } = setup({ "GET /api/guests/me": () => json({ guest: alice }) });
    const seen: string[] = [];
    session.subscribe(() => seen.push(session.getState().status));

    const loading = session.get();
    expect(session.getState().status).toBe("loading");
    await loading;

    expect(session.getState()).toEqual({ status: "ready", guest: alice });
    expect(seen).toEqual(["loading", "ready"]);
  });

  it("まだゲストでなければ anonymous", async () => {
    const { session } = setup({});

    await session.get();

    expect(session.getState()).toEqual({ status: "anonymous", guest: null });
  });

  it("読み込みに失敗したら error", async () => {
    localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify("t-1"));
    const { session } = setup({ "GET /api/guests/me": () => json({}, 503) });

    await session.get().catch(() => {});

    expect(session.getState().status).toBe("error");
  });

  it("登録・名前の変更でも ready の中身が変わる", async () => {
    const { session } = setup({
      "POST /api/guests": () => json({ guest: alice, token: "t" }, 201),
      "PATCH /api/guests/me": () => json({ guest: { ...alice, name: "ゆう" } }),
    });

    await session.ensure();
    expect(session.getState()).toEqual({ status: "ready", guest: alice });

    await session.rename("ゆう");
    expect(session.getState().guest?.name).toBe("ゆう");
  });

  it("状態が変わらなければ同じオブジェクトを返す（React の useSyncExternalStore が無限に描き直さない）", async () => {
    const { session } = setup({});
    await session.get();

    expect(session.getState()).toBe(session.getState());
  });

  it("購読をやめたら知らせない", async () => {
    const { session } = setup({});
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    unsubscribe();
    await session.get();

    expect(listener).not.toHaveBeenCalled();
  });
});
