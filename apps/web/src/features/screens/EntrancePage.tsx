import type { GuestSession } from "@app/identity-client";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SkinnedGame, type SkinnedGameProps } from "./SkinnedGame";
import { createRoom as createRoomWith } from "@/features/table/room-actions";
import type { Screen } from "@/game/screens";
import { api } from "@/lib/api";
import { guestSession } from "@/lib/guest";

const createRoomLive = () =>
  createRoomWith({ client: api, ensureGuest: () => guestSession.ensure() });

type Props = SkinnedGameProps & {
  /** テストで差し替える */
  createRoom?: typeof createRoomLive;
  session?: GuestSession;
};

/** 入口（/）。ルームを作ったら、そのルームの画面（招待 URL）へ移る */
export function EntrancePage({
  createRoom = createRoomLive,
  session = guestSession,
  ...game
}: Props) {
  const navigate = useNavigate();
  const screen = useMemo<Screen>(
    () => ({
      kind: "entrance",
      guest: session,
      createRoom: async () => {
        const result = await createRoom();
        if (!result.ok) return result;
        navigate(`/r/${encodeURIComponent(result.roomId)}`);
        return { ok: true };
      },
    }),
    [createRoom, navigate, session]
  );
  return <SkinnedGame screen={screen} {...game} />;
}
