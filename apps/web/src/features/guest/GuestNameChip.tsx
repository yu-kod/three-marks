import { GUEST_NAME_MAX_LENGTH } from "@app/identity-client";
import { useGuest } from "@app/identity-client/react";
import { ApiRequestError } from "@app/web-core";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 今のゲストの名前。押すとその場で変えられる。
 *
 * 名前は最初に入力させず、サーバーが付けた仮の名前（「ねむいペンギン」など）で始める。
 * 変えたい人だけがここから変える（docs/guest-flow.md）。
 * まだゲストでなければ何も出さない。
 */
export function GuestNameChip() {
  const { status, guest, rename } = useGuest();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (status !== "ready") {
    return null;
  }

  const close = () => {
    setDraft(null);
    setError(null);
  };

  if (draft === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="max-w-full rounded-full"
        aria-label={`名前を変える（今: ${guest.name}）`}
        onClick={() => setDraft(guest.name)}
      >
        <span className="truncate">{guest.name}</span>
        <span aria-hidden="true">✎</span>
      </Button>
    );
  }

  const name = draft.trim();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name === guest.name) {
      close();
      return;
    }
    setSaving(true);
    try {
      await rename(name);
      close();
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : "名前を変えられなかった");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  return (
    <form
      className="flex min-w-0 flex-1 flex-col items-end gap-1"
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
    >
      <div className="flex w-full max-w-72 items-center gap-1">
        <Input
          aria-label="名前"
          value={draft}
          maxLength={GUEST_NAME_MAX_LENGTH}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          className="h-9 min-w-0 flex-1"
        />
        <Button type="submit" size="sm" disabled={name === "" || saving}>
          保存
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="取り消す" onClick={close}>
          <span aria-hidden="true">✕</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
