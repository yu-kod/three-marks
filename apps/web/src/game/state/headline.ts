import type { TableState } from "./table-store";

/** 画面の上に出す一言 */
export function tableHeadline(state: TableState): string {
  switch (state.status) {
    case "loading":
      return "読み込み中…";
    case "error":
      return state.code === "ROOM_NOT_FOUND" ? "ルームが見つかりません" : "読み込めませんでした";
    case "ready": {
      const { room, game } = state;
      if (room.status === "finished") return "GAME OVER";
      if (game === null) return `待合室 ${room.members.length} / ${room.maxPlayers} 人`;
      return `ROUND ${game.round}`;
    }
  }
}
