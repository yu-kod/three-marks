import { useEffect, useRef } from "react";
import { mountPhaser } from "@/game/phaser/mount";
import type { Screen } from "@/game/screens";
import type { Skin } from "@/game/skin/skin";

/**
 * 入れ物に Phaser のゲームを描き始める。片付けるときは返した関数を呼ぶ。
 * signal が中止されていたらゲームを作らない（前のゲームと重なると、キャンバスの位置がずれてタップが外れる）。
 */
export type MountGame = (
  parent: HTMLElement,
  options: { skin: Skin; screen: Screen; signal: AbortSignal }
) => Promise<() => void>;

type Props = {
  skin: Skin;
  screen: Screen;
  /** テストで差し替える */
  mount?: MountGame;
};

/** Phaser の入れ物。描くのは Phaser で、React はここに置くだけ */
export function GameCanvas({ skin, screen, mount = mountPhaser }: Props) {
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    let destroy: (() => void) | null = null;
    const left = new AbortController();
    void mount(container.current!, { skin, screen, signal: left.signal }).then((d) => {
      if (left.signal.aborted) d();
      else destroy = d;
    });
    return () => {
      left.abort();
      destroy?.();
    };
  }, [mount, skin, screen]);

  return (
    <section ref={container} aria-label="ゲーム画面" className="h-svh w-full overflow-hidden" />
  );
}
