/**
 * React 用のアダプタ（`@app/identity-client/react`）。
 *
 * 状態はセッション本体が持ち、ここでは useSyncExternalStore で読むだけ。
 * ゲームエンジン側は本体（`@app/identity-client`）を直接購読すればよく、React を読み込まない。
 */
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Guest, GuestSession, GuestState } from "./guest-session.js";

export type GuestContextValue = GuestState & {
  /** ゲストでなければ登録する。名前を渡せばその名前で（すでにゲストならその名前に変える） */
  ensureGuest: (name?: string) => Promise<Guest>;
  rename: (name: string) => Promise<Guest>;
};

const GuestContext = createContext<GuestSession | null>(null);

type Props = {
  session: GuestSession;
  children?: ReactNode;
};

/** アプリ全体を包み、useGuest() で今のゲストを読めるようにする。表示したら前回のゲストを読み込む */
export function GuestProvider({ session, children }: Props) {
  useEffect(() => {
    // 失敗はセッションの状態（error）として画面へ伝わるので、ここでは握りつぶす
    session.get().catch(() => {});
  }, [session]);

  return <GuestContext.Provider value={session}>{children}</GuestContext.Provider>;
}

export function useGuest(): GuestContextValue {
  const session = useContext(GuestContext);
  if (session === null) {
    throw new Error("useGuest() は GuestProvider の中で使う");
  }
  const state = useSyncExternalStore(session.subscribe, session.getState);
  return { ...state, ensureGuest: session.ensure, rename: session.rename };
}
