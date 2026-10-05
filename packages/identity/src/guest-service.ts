import { randomUUID } from "node:crypto";
import { UnauthorizedError } from "@app/server-core";
import type { GuestRecord, GuestStore } from "./guest-store.js";
import type { GuestIdentity } from "./identity.js";
import { generateToken as defaultGenerateToken, hashToken } from "./token.js";

/** ゲストの有効期間。使われ続けている間は延びる */
export const GUEST_TTL_SECONDS = 30 * 24 * 60 * 60;

export type GuestServiceDeps = {
  store: GuestStore;
  /** 現在時刻（ミリ秒） */
  now?: () => number;
  generateToken?: () => string;
  generateId?: () => string;
};

/**
 * ゲスト（アカウントを作らない利用者）の登録と認証。
 *
 * トークンは発行時に一度だけ返し、保存するのはハッシュだけにする。
 * 期限は最後に使われてから最大 30 日。残りが半分を切ったときだけ延ばして、
 * 認証のたびに書き込まないようにする。
 */
export function createGuestService({
  store,
  now = Date.now,
  generateToken = defaultGenerateToken,
  generateId = randomUUID,
}: GuestServiceDeps) {
  const nowSeconds = () => Math.floor(now() / 1000);
  const toIdentity = (record: GuestRecord): GuestIdentity => ({
    kind: "guest",
    id: record.guestId,
    name: record.name,
  });

  async function findValid(token: string): Promise<GuestRecord | null> {
    const record = await store.findByTokenHash(hashToken(token));
    if (record === null || record.expiresAt <= nowSeconds()) {
      return null;
    }
    return record;
  }

  return {
    async register(name: string): Promise<{ guest: GuestIdentity; token: string }> {
      const token = generateToken();
      const createdAt = nowSeconds();
      const record: GuestRecord = {
        tokenHash: hashToken(token),
        guestId: generateId(),
        name,
        createdAt,
        expiresAt: createdAt + GUEST_TTL_SECONDS,
      };
      await store.create(record);
      return { guest: toIdentity(record), token };
    },

    async authenticate(token: string): Promise<GuestIdentity | null> {
      const record = await findValid(token);
      if (record === null) {
        return null;
      }
      const current = nowSeconds();
      if (record.expiresAt - current < GUEST_TTL_SECONDS / 2) {
        await store.update(record.tokenHash, { expiresAt: current + GUEST_TTL_SECONDS });
      }
      return toIdentity(record);
    },

    async rename(token: string, name: string): Promise<GuestIdentity> {
      const record = await findValid(token);
      if (record === null) {
        throw new UnauthorizedError();
      }
      await store.update(record.tokenHash, { name });
      return toIdentity({ ...record, name });
    },
  };
}

export type GuestService = ReturnType<typeof createGuestService>;
