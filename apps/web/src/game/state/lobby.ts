import type { RoomView } from "./types";

export type Seat =
  | {
      kind: "player";
      id: string;
      name: string;
      host: boolean;
      me: boolean;
      /** ホストが、この人をひとつ前の席へ動かせる */
      canMoveUp: boolean;
    }
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
  const host = room.hostId === me && room.members.some((m) => m.id === me);
  const players: Seat[] = room.members.map((m, index) => ({
    kind: "player",
    id: m.id,
    name: m.name,
    host: m.id === room.hostId,
    me: m.id === me,
    canMoveUp: host && index > 0,
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
    host,
  };
}

/** index の席の人を、ひとつ前の人と入れ替えた並び（ホストが送る席順） */
export function orderMovingUp(view: LobbyView, index: number): string[] {
  const ids = view.seats.flatMap((s) => (s.kind === "player" ? [s.id] : []));
  [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
  return ids;
}

export type LobbyAction = "join" | "leave" | "share" | "start" | "draw";

/** 待合室のボタン。primary は一番押してほしいもの（1画面に1つ） */
export type LobbyButton = { action: LobbyAction; label: string; primary: boolean };

/** 上から並べる順に返す */
export function lobbyButtons(view: LobbyView): LobbyButton[] {
  const share = (primary: boolean): LobbyButton => ({
    action: "share",
    label: "招待 URL を送る",
    primary,
  });
  const leave: LobbyButton = { action: "leave", label: "席を離れる", primary: false };
  if (view.host) {
    return [
      { action: "start", label: "ゲームを始める", primary: true },
      { action: "draw", label: "カードを引いて席順を決める", primary: false },
      share(false),
      leave,
    ];
  }
  if (view.canJoin) {
    return [{ action: "join", label: "参加する", primary: true }, share(false)];
  }
  if (view.joined) return [share(true), leave];
  return [share(true)];
}
