import { tableHeadline } from "./headline";
import { lobbyButtons, lobbyView, type LobbyButton, type LobbyView } from "./lobby";
import type { TableState } from "./table-store";

/** ルームの画面に描くもの。前と同じなら描き直さない（押している途中のボタンを消さないため） */
export type RoomModel =
  | { kind: "loading" | "error" | "playing"; headline: string }
  | { kind: "lobby"; headline: string; view: LobbyView; buttons: LobbyButton[] };

export function roomModel(state: TableState, me: string | null): RoomModel {
  const headline = tableHeadline(state);
  if (state.status !== "ready") return { kind: state.status, headline };
  if (state.room.status !== "waiting") return { kind: "playing", headline };
  const view = lobbyView(state.room, me);
  return { kind: "lobby", headline, view, buttons: lobbyButtons(view) };
}
