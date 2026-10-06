import type { ThrowRecord } from "@three-marks/engine";

/** サーバーが代わりに進めた投げ（解釈メモ17）なら、全員に出す一言。自分で投げた投げなら null */
export function autoNotice(
  record: Pick<ThrowRecord, "auto">,
  who: string,
  mine: boolean
): string | null {
  if (!record.auto) return null;
  return mine ? "時間切れ。代わりに投げました" : `${who} の時間切れ。代わりに投げました`;
}
