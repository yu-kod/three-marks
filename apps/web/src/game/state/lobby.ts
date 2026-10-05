import type { RoomView } from "./types";

export type Seat =
  | { kind: "player"; name: string; host: boolean; me: boolean }
  /** 空いた席。ゲームを始めると CPU が座る（解釈メモ13） */
  | { kind: "cpu" };

/** 待合室で見せること。me は今のゲストの ID（まだゲストでなければ null） */
export type LobbyView = {
  seats: Seat[];
  /** 誰のルームか。ホストが席を離れていれば null */
  hostName: string | null;
  joined: boolean;
  canJoin: boolean;
  host: boolean;
};

export function lobbyView(room: RoomView, me: string | null): LobbyView {
  const players: Seat[] = room.members.map((m) => ({
    kind: "player",
    name: m.name,
    host: m.id === room.hostId,
    me: m.id === me,
  }));
  const empty: Seat[] = Array.from({ length: room.maxPlayers - players.length }, () => ({
    kind: "cpu",
  }));
  const joined = room.members.some((m) => m.id === me);
  return {
    seats: [...players, ...empty],
    hostName: room.members.find((m) => m.id === room.hostId)?.name ?? null,
    joined,
    canJoin: !joined && room.members.length < room.maxPlayers,
    host: me !== null && room.hostId === me,
  };
}

export type LobbyAction = "join" | "leave" | "share";

/** 待合室のボタン。primary は一番押してほしいもの（1画面に1つ） */
export type LobbyButton = { action: LobbyAction; label: string; primary: boolean };

/** 上から並べる順に返す */
export function lobbyButtons(view: LobbyView): LobbyButton[] {
  const share = (primary: boolean): LobbyButton => ({
    action: "share",
    label: "招待 URL を送る",
    primary,
  });
  if (view.canJoin) {
    return [{ action: "join", label: "参加する", primary: true }, share(false)];
  }
  if (view.joined) {
    return [share(true), { action: "leave", label: "席を離れる", primary: false }];
  }
  return [share(true)];
}
