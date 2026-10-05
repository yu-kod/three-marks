import { createApiClient } from "@app/web-core";
import { guestSession } from "./guest";

/**
 * アプリ全体で使う API クライアント。ゲストならそのトークンを付けて送る。
 *
 * 本番は CloudFront が /api/* を API Gateway へ流し、開発時は Vite が apps/api へ
 * プロキシするので、どちらも同じオリジンの相対パスで呼べる。
 */
export const api = createApiClient({ getToken: () => guestSession.token() });
