import type { SeatDraw } from "@three-marks/engine";

/** API が返すルーム（apps/api/src/rooms/room-service.ts の RoomView と同じ形） */
export type RoomView = {
  id: string;
  hostId: string;
  members: { id: string; name: string; cpu: boolean }[];
  maxPlayers: number;
  seatDraw: SeatDraw[][] | null;
  status: "waiting" | "playing" | "finished";
};
