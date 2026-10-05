import { createGuestSession } from "@app/identity-client";
import { createApiClient, createJsonStorage } from "@app/web-core";

/**
 * このブラウザのゲストセッション。トークンは localStorage に残り、次に来たときも同じゲストになる。
 *
 * 登録と自分の取得は自前の API クライアントで行う（アプリの api はこのトークンを使う側）。
 */
export const guestSession = createGuestSession({
  api: createApiClient(),
  storage: createJsonStorage(),
});
