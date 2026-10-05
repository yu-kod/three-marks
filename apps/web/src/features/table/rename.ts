import { GUEST_NAME_MAX_LENGTH, type Guest } from "@app/identity-client";
import { messageOf, type ActionResult } from "./room-actions";

/**
 * 名前を変える。まだゲストでなければ、その名前でゲストになる（ensure に名前を渡す）。
 * 空や長すぎる名前は送らずに伝える（サーバーも確かめる）。
 */
export async function renameGuest(
  ensure: (name: string) => Promise<Guest>,
  input: string
): Promise<ActionResult> {
  const name = input.trim();
  if (name === "") return { ok: false, message: "名前を入れてください" };
  if (name.length > GUEST_NAME_MAX_LENGTH) {
    return { ok: false, message: `名前は${GUEST_NAME_MAX_LENGTH}文字までです` };
  }
  try {
    await ensure(name);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}
