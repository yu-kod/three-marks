import { ApiRequestError, type ApiClient, type JsonStorage } from "@app/web-core";

/** サーバー（@app/identity）の GuestIdentity と同じ形 */
export type Guest = { kind: "guest"; id: string; name: string };

/** サーバー（@app/identity）の GUEST_NAME_MAX_LENGTH と揃える */
export const GUEST_NAME_MAX_LENGTH = 20;

/** 既定の保存先のキー。同じドメインに複数のアプリを置くなら storageKey で分ける */
export const GUEST_TOKEN_KEY = "guest:token";

/**
 * 今のゲストの状態。
 *
 * idle: まだ読み込んでいない / loading: 読み込み中 / anonymous: まだゲストでない /
 * ready: ゲスト / error: 前回のゲストを読み込めなかった（通信の失敗など）
 */
export type GuestState =
  | { status: "idle"; guest: null }
  | { status: "loading"; guest: null }
  | { status: "anonymous"; guest: null }
  | { status: "ready"; guest: Guest }
  | { status: "error"; guest: null };

export type GuestSessionOptions = {
  api: ApiClient;
  storage: JsonStorage;
  storageKey?: string;
};

/**
 * ブラウザ側のゲストセッション。React にもゲームエンジンにも依存しないストア。
 *
 * - トークンは localStorage に保存し、次に来たときも同じゲストとして扱う
 * - ensure() で初めて登録する。名前を渡さなければサーバーが仮の名前を付ける
 * - 同時に呼ばれても登録は1回だけ（連打や StrictMode の二重実行で別人が増えない）
 * - トークンが失効していたら（401）捨てる。通信の失敗では捨てない
 * - 状態は getState() で読み、subscribe() で変化を受け取る（React は useSyncExternalStore、
 *   Phaser などはシーンから直接購読する）
 */
export function createGuestSession({
  api,
  storage,
  storageKey = GUEST_TOKEN_KEY,
}: GuestSessionOptions) {
  /** 今わかっているゲスト。失敗したら捨てて、次の呼び出しでやり直す */
  let current: Promise<Guest | null> | null = null;
  let state: GuestState = { status: "idle", guest: null };
  const listeners = new Set<() => void>();

  function setState(next: GuestState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  const settle = (guest: Guest | null) =>
    setState(guest ? { status: "ready", guest } : { status: "anonymous", guest: null });

  const token = () => storage.get<string>(storageKey);

  function remember<T extends Guest | null>(promise: Promise<T>): Promise<T> {
    current = promise;
    promise.catch(() => {
      if (current === promise) current = null;
    });
    return promise;
  }

  async function fetchMe(): Promise<Guest | null> {
    const saved = token();
    if (saved === null) {
      return null;
    }
    try {
      const { guest } = await api.request<{ guest: Guest }>("/api/guests/me", { token: saved });
      return guest;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        storage.remove(storageKey);
        return null;
      }
      throw error;
    }
  }

  async function register(name: string | undefined): Promise<Guest> {
    const { guest, token: issued } = await api.request<{ guest: Guest; token: string }>(
      "/api/guests",
      { method: "POST", body: name === undefined ? {} : { name } }
    );
    storage.set(storageKey, issued);
    return guest;
  }

  function get(): Promise<Guest | null> {
    if (current) {
      return current;
    }
    setState({ status: "loading", guest: null });
    const loading = remember(fetchMe());
    loading.then(settle, () => setState({ status: "error", guest: null }));
    return loading;
  }

  async function rename(name: string): Promise<Guest> {
    await ensure();
    const { guest } = await api.request<{ guest: Guest }>("/api/guests/me", {
      method: "PATCH",
      body: { name },
      token: token(),
    });
    current = Promise.resolve(guest);
    settle(guest);
    return guest;
  }

  /**
   * ゲストでなければ登録する。何かを始めるボタンの中で呼ぶ。
   *
   * name を渡すと、その名前で登録する（すでにゲストなら、その名前に変える）。
   */
  async function ensure(name?: string): Promise<Guest> {
    const guest = await remember(get().then((found) => found ?? register(name)));
    settle(guest);
    if (name !== undefined && guest.name !== name) {
      return rename(name);
    }
    return guest;
  }

  return {
    get,
    ensure,
    rename,
    token,
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type GuestSession = ReturnType<typeof createGuestSession>;
