/** shareInvite が使うブラウザの機能（navigator の一部） */
export type ShareTarget = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/** 共有した結果。message は画面に出す一言（出すことが無ければ null） */
export type ShareResult = { ok: boolean; message: string | null };

const isCancel = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * 招待 URL を送る。スマホなら共有の画面（Web Share API）を開き、使えなければコピーする。
 */
export async function shareInvite(
  url: string,
  target: ShareTarget = navigator
): Promise<ShareResult> {
  if (target.share) {
    try {
      await target.share({ title: "THREE MARKS", text: "一緒に遊ぼう", url });
      return { ok: true, message: null };
    } catch (error) {
      if (isCancel(error)) return { ok: true, message: null };
      // 共有できなかったときはコピーに回る
    }
  }
  try {
    await target.clipboard!.writeText(url);
    return { ok: true, message: "招待 URL をコピーしました" };
  } catch {
    return { ok: false, message: `コピーできませんでした。この URL を送ってください: ${url}` };
  }
}
