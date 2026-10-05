import { gameModel, type GameModel } from "./game-model";
import { tableHeadline } from "./headline";
import { lobbyButtons, lobbyView, type LobbyButton, type LobbyView } from "./lobby";
import { seatDrawRounds, type SeatDrawRound } from "./seat-draw";
import type { TableState } from "./table-store";

/** ルームの画面に描くもの。前と同じなら描き直さない（押している途中のボタンを消さないため） */
export type RoomModel =
  | { kind: "loading" | "error"; headline: string }
  | { kind: "game"; headline: string; game: GameModel }
  | {
      kind: "lobby";
      headline: string;
      view: LobbyView;
      buttons: LobbyButton[];
      /** カードを引いて席順を決めた結果（引いていなければ null） */
      seatDraw: SeatDrawRound[] | null;
    };

export function roomModel(state: TableState, me: string | null): RoomModel {
  const headline = tableHeadline(state);
  if (state.status !== "ready") return { kind: state.status, headline };
  if (state.room.status !== "waiting") {
    // 始まったルームでは、ストアがゲームも一緒に取ってくる（table-store）
    return { kind: "game", headline, game: gameModel(state.room, state.game!, me) };
  }
  const view = lobbyView(state.room, me);
  return {
    kind: "lobby",
    headline,
    view,
    buttons: lobbyButtons(view),
    seatDraw: seatDrawRounds(state.room),
  };
}
