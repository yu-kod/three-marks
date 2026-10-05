import type { GuestSession } from "@app/identity-client";
import type { ApiClient } from "@app/web-core";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SkinnedGame, type SkinnedGameProps } from "./SkinnedGame";
import { renameGuest } from "@/features/table/rename";
import { createRoomActions } from "@/features/table/room-actions";
import { shareInvite, type ShareTarget } from "@/features/table/share-invite";
import { createTableApi } from "@/features/table/table-api";
import type { Screen } from "@/game/screens";
import { createTableStore, type TableStore } from "@/game/state/table-store";
import { api } from "@/lib/api";
import { guestSession } from "@/lib/guest";
import { subscribeRoomUpdates } from "@/lib/room-updates";

/** API と WebSocket（無ければポーリング）からルームの状態を取り込むストア */
const createLiveStore = (roomId: string) =>
  createTableStore({
    roomId,
    api: createTableApi(api),
    subscribe: (options) =>
      subscribeRoomUpdates({ ...options, url: import.meta.env.VITE_WS_URL as string | undefined }),
  });

type Props = SkinnedGameProps & {
  /** テストで差し替える */
  createStore?: (roomId: string) => TableStore;
  session?: GuestSession;
  client?: ApiClient;
  shareTarget?: ShareTarget;
};

/** 招待 URL（/r/:id）の画面。描くのは Phaser で、ここは状態と操作を用意して渡すだけ */
export function RoomPage({
  createStore = createLiveStore,
  session = guestSession,
  client = api,
  shareTarget,
  ...game
}: Props) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const store = useMemo(() => createStore(id), [createStore, id]);

  useEffect(() => store.start(), [store]);

  const screen = useMemo<Screen>(() => {
    const actions = createRoomActions({
      client,
      ensureGuest: () => session.ensure(),
      roomId: id,
      refresh: store.refresh,
    });
    const inviteUrl = `${window.location.origin}/r/${encodeURIComponent(id)}`;
    return {
      kind: "room",
      guest: session,
      store,
      home: () => navigate("/"),
      rename: (name) => renameGuest((n) => session.ensure(n), name),
      actions: { ...actions, share: () => shareInvite(inviteUrl, shareTarget) },
    };
  }, [client, id, navigate, session, shareTarget, store]);

  return <SkinnedGame screen={screen} {...game} />;
}
