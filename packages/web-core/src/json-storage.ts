/**
 * localStorage に JSON を出し入れする。
 *
 * プライベートウィンドウやサイトデータのブロックでは localStorage へのアクセス自体が
 * 例外を投げることがある。読み書きはすべて例外を飲み込み、使えないときは
 * 「保存されていない」として振る舞う。保存できなくてもアプリが落ちないことを優先する。
 */
export function createJsonStorage(storage: () => Storage = () => window.localStorage) {
  return {
    get<T>(key: string): T | null {
      try {
        const raw = storage().getItem(key);
        return raw === null ? null : (JSON.parse(raw) as T);
      } catch {
        return null;
      }
    },

    set(key: string, value: unknown): void {
      try {
        storage().setItem(key, JSON.stringify(value));
      } catch {
        // 保存できなくても動き続ける
      }
    },

    remove(key: string): void {
      try {
        storage().removeItem(key);
      } catch {
        // 同上
      }
    },
  };
}

export type JsonStorage = ReturnType<typeof createJsonStorage>;
