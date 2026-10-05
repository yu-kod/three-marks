import { useEffect, useRef } from "react";
import { mountPhaser } from "@/game/phaser/mount";
import type { Skin } from "@/game/skin/skin";
import type { TableStore } from "@/game/state/table-store";

/** 入れ物に Phaser のゲームを描き始める。片付けるときは返した関数を呼ぶ */
export type MountTable = (
  parent: HTMLElement,
  options: { skin: Skin; store: TableStore }
) => Promise<() => void>;

type Props = {
  skin: Skin;
  store: TableStore;
  /** テストで差し替える */
  mount?: MountTable;
};

/** Phaser の入れ物。描くのは Phaser で、React はここに置くだけ */
export function TableCanvas({ skin, store, mount = mountPhaser }: Props) {
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    let destroy: (() => void) | null = null;
    let left = false;
    void mount(container.current!, { skin, store }).then((d) => {
      if (left) d();
      else destroy = d;
    });
    return () => {
      left = true;
      destroy?.();
    };
  }, [mount, skin, store]);

  return (
    <section ref={container} aria-label="ゲーム画面" className="h-svh w-full overflow-hidden" />
  );
}
