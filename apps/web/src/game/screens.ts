import type { GuestSession } from "@app/identity-client";
import type { ActionResult } from "@/features/table/room-actions";
import type { ShareResult } from "@/features/table/share-invite";
import type { TableStore } from "@/game/state/table-store";

/**
 * Phaser に描かせる画面と、その画面から呼べる操作。
 * Phaser 側は状態を読んで描き、ボタンで操作を呼ぶだけ（分岐や通信はここに渡す側で済ませる）。
 */
export type Screen =
  | {
      kind: "entrance";
      guest: GuestSession;
      /** ルームを作って、そのルームの画面へ移る */
      createRoom: () => Promise<ActionResult>;
      rename: (name: string) => Promise<ActionResult>;
    }
  | {
      kind: "room";
      guest: GuestSession;
      store: TableStore;
      rename: (name: string) => Promise<ActionResult>;
      actions: {
        join: () => Promise<ActionResult>;
        leave: () => Promise<ActionResult>;
        share: () => Promise<ShareResult>;
        /** ここからはホストだけ */
        start: () => Promise<ActionResult>;
        drawSeats: () => Promise<ActionResult>;
        arrange: (order: string[]) => Promise<ActionResult>;
      };
    };
