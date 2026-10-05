import { useEffect, useState } from "react";
import { GameCanvas, type MountGame } from "@/features/table/GameCanvas";
import type { Screen } from "@/game/screens";
import { loadSavedSkin } from "./saved-skin";
import type { Skin } from "@/game/skin/skin";

export type SkinnedGameProps = {
  /** テストで差し替える */
  loadSkin?: () => Promise<Skin>;
  mount?: MountGame;
};

type SkinState = { status: "loading" } | { status: "ready"; skin: Skin } | { status: "error" };

/** スキンを読み込んでから、画面を Phaser に描かせる */
export function SkinnedGame({
  screen,
  loadSkin: load = loadSavedSkin,
  mount,
}: SkinnedGameProps & { screen: Screen }) {
  const [skin, setSkin] = useState<SkinState>({ status: "loading" });

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
  return <GameCanvas skin={skin.skin} screen={screen} mount={mount} />;
}
