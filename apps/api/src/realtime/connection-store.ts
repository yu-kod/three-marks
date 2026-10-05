/** WebSocket の接続1本。どのルームの更新を受け取るか */
export type Connection = {
  connectionId: string;
  roomId: string;
  /** UNIX 秒。API Gateway の接続は最長 2 時間なので、それを過ぎた記録は消してよい */
  expiresAt: number;
};

export type ConnectionStore = {
  add(connection: Connection): Promise<void>;
  /** 切断のときはルームが分からないので、接続 ID だけで外す。無ければ何もしない */
  remove(connectionId: string): Promise<void>;
  /** ルームの更新を送る先 */
  listByRoom(roomId: string): Promise<string[]>;
};

/** ローカル開発とテスト用。プロセスが終われば消える */
export function createInMemoryConnectionStore(): ConnectionStore {
  const connections = new Map<string, Connection>();

  return {
    async add(connection) {
      connections.set(connection.connectionId, { ...connection });
    },

    async remove(connectionId) {
      connections.delete(connectionId);
    },

    async listByRoom(roomId) {
      return [...connections.values()]
        .filter((c) => c.roomId === roomId)
        .map((c) => c.connectionId);
    },
  };
}
