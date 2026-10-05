/**
 * リクエストの主体。認証方式が違っても、アプリはこの形だけを見る。
 *
 * Cognito（アカウント）方式を足すときは `{ kind: "user"; ... }` をここへ加える。
 */
export type GuestIdentity = { kind: "guest"; id: string; name: string };

export type Identity = GuestIdentity;

/** Bearer トークンから主体を引く。分からなければ null */
export type IdentityResolver = (token: string) => Promise<Identity | null>;
