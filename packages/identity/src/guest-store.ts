import { ConflictError, NotFoundError } from "@app/server-core";

/** 保存するゲストの情報。平文のトークンは持たない */
export type GuestRecord = {
  /** トークンの SHA-256。これで引く */
  tokenHash: string;
  guestId: string;
  name: string;
  /** UNIX 秒 */
  createdAt: number;
  /** UNIX 秒。過ぎたら無効（DynamoDB の TTL もこの属性で消す） */
  expiresAt: number;
};

export type GuestStore = {
  /** 新規作成。同じ tokenHash が既にあれば ConflictError */
  create(record: GuestRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<GuestRecord | null>;
  /**
   * 既存のゲストの一部だけを書き換える。無ければ NotFoundError。
   *
   * 丸ごと書き戻さないのは、期限の延長と名前の変更が同時に走っても互いを消さないため。
   */
  update(tokenHash: string, changes: GuestChanges): Promise<void>;
};

/** update で書き換えられる項目 */
export type GuestChanges = Partial<Pick<GuestRecord, "name" | "expiresAt">>;

/** ローカル開発とテスト用。プロセスが終われば消える */
export function createInMemoryGuestStore(): GuestStore {
  const records = new Map<string, GuestRecord>();

  return {
    async create(record) {
      if (records.has(record.tokenHash)) {
        throw new ConflictError("同じトークンのゲストが既にいる");
      }
      records.set(record.tokenHash, { ...record });
    },

    async findByTokenHash(tokenHash) {
      const record = records.get(tokenHash);
      return record ? { ...record } : null;
    },

    async update(tokenHash, changes) {
      const record = records.get(tokenHash);
      if (!record) {
        throw new NotFoundError("ゲストが見つからない");
      }
      records.set(tokenHash, { ...record, ...changes });
    },
  };
}
