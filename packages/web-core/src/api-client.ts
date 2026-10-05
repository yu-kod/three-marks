/**
 * バックエンド API のクライアント。
 *
 * サーバーのエラー形式 `{ error: { code, message } }` を ApiRequestError に読み替え、
 * 画面側が code で分岐できるようにする。
 */

export class ApiRequestError extends Error {
  constructor(
    /** HTTP ステータス。サーバーへ届かなかったときは 0 */
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export type ApiClientOptions = {
  /** API の配信元。同じオリジン（CloudFront 経由 / dev サーバーのプロキシ）なら空でよい */
  baseUrl?: string;
  /** 既定で付ける資格情報（ログイン中のアクセストークン、ゲストのトークン等） */
  getToken?: () => string | null | undefined;
  /** 401 を受けたとき（資格情報の失効）に呼ぶ。セッションの破棄やログイン画面への誘導に使う */
  onUnauthorized?: () => void;
  /** テストで差し替える */
  fetch?: typeof fetch;
};

export type RequestOptions = {
  method?: string;
  /** JSON にして送る */
  body?: unknown;
  /** この呼び出しだけ使う資格情報。getToken より優先する */
  token?: string | null;
  signal?: AbortSignal;
};

type ErrorBody = { error?: { code?: string; message?: string } };

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = "", getToken, onUnauthorized } = options;

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const headers = new Headers();
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    const token = init.token !== undefined ? init.token : getToken?.();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const doFetch = options.fetch ?? fetch;
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: init.signal,
      });
    } catch {
      throw new ApiRequestError(0, "NETWORK_ERROR", "サーバーに接続できない");
    }

    if (!res.ok) {
      if (res.status === 401) {
        onUnauthorized?.();
      }
      // エラー本文が読めない場合（502 で HTML が返る等）でも、ステータス付きで失敗させる
      const body = (await res.json().catch(() => ({}))) as ErrorBody;
      throw new ApiRequestError(
        res.status,
        body.error?.code ?? `HTTP_${res.status}`,
        body.error?.message ?? "通信に失敗した"
      );
    }

    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
