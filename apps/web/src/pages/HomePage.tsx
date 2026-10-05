import { useGuest } from "@app/identity-client/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * トップページ。名前を聞かずに始められる流れの見本（docs/guest-flow.md）。
 *
 * アプリを作り始めたら「はじめる」を「ルームを作る」などに差し替える。
 * そのボタンの中で ensureGuest() を呼べば、初めての人も入力なしで先へ進める。
 */
export default function HomePage() {
  const { status, guest, ensureGuest } = useGuest();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setStarting(true);
    setFailed(false);
    try {
      await ensureGuest();
    } catch {
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4">
      {status === "ready" ? (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">ようこそ、{guest.name} さん</h1>
          <p className="text-muted-foreground">名前は右上からいつでも変えられます。</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold sm:text-3xl">Three Marks</h1>
          <p className="text-muted-foreground">名前を入力しなくても、すぐに始められます。</p>
          <Button
            size="lg"
            className="self-start"
            disabled={status === "loading" || starting}
            onClick={start}
          >
            はじめる
          </Button>
          {failed && (
            <p role="alert" className="text-destructive">
              はじめられなかった。通信の状態を確かめて、もう一度押してください。
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="text-destructive">
              サーバーに接続できない。時間をおいて開き直してください。
            </p>
          )}
        </>
      )}
    </main>
  );
}
