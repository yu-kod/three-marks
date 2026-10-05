import { createJsonStorage } from "@app/web-core";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createTableApi } from "./table-api";
import { TableCanvas, type MountTable } from "./TableCanvas";
import { loadSkin, savedSkinId } from "@/game/skin/load-skin";
import type { Skin } from "@/game/skin/skin";
import { createTableStore, type TableStore } from "@/game/state/table-store";
import { api } from "@/lib/api";
import { subscribeRoomUpdates } from "@/lib/room-updates";

/** 端末に保存したスキンを読む */
const loadSavedSkin = () =>
  loadSkin(savedSkinId(createJsonStorage()), { origin: window.location.origin });

/** API と WebSocket（無ければポーリング）からルームの状態を取り込むストア */
const createLiveStore = (roomId: string) =>
  createTableStore({
    roomId,
    api: createTableApi(api),
    subscribe: (options) =>
      subscribeRoomUpdates({ ...options, url: import.meta.env.VITE_WS_URL as string | undefined }),
  });

type Props = {
  /** テストで差し替える */
  loadSkin?: () => Promise<Skin>;
  createStore?: (roomId: string) => TableStore;
  mount?: MountTable;
};

type SkinState = { status: "loading" } | { status: "ready"; skin: Skin } | { status: "error" };

/** 招待 URL（/r/:id）の画面。描くのは Phaser で、ここはスキンとストアを用意して渡すだけ */
export function TablePage({
  loadSkin: load = loadSavedSkin,
  createStore = createLiveStore,
  mount,
}: Props) {
  const { id = "" } = useParams();
  const store = useMemo(() => createStore(id), [createStore, id]);
  const [skin, setSkin] = useState<SkinState>({ status: "loading" });

  useEffect(() => store.start(), [store]);

  useEffect(() => {
    load().then(
      (skin) => setSkin({ status: "ready", skin }),
      () => setSkin({ status: "error" })
    );
  }, [load]);

  if (skin.status === "error") {
    return (
      <p role="alert" className="p-4 text-destructive">
        画面を読み込めませんでした。開き直してください。
      </p>
    );
  }
  if (skin.status === "loading") return null;
  return <TableCanvas skin={skin.skin} store={store} mount={mount} />;
}
