/** ルームの更新の知らせ（apps/api/src/realtime/notifier.ts と同じ形） */
type RoomChanged = { type: "room-changed"; roomId: string };

/** subscribeRoomUpdates が使う WebSocket の部分 */
type Socket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  close(): void;
};

export type RoomUpdatesOptions = {
  /** WebSocket API の URL（VITE_WS_URL）。無ければポーリングだけで動く */
  url: string | undefined;
  roomId: string;
  /** ルームが変わったかもしれないとき。受け取った側が状態を取り直す */
  onChange: () => void;
  /** WebSocket が繋がっていない間に取り直す間隔 */
  pollIntervalMs?: number;
  /** テストで差し替える */
  createSocket?: (url: string) => Socket;
};

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * ルームの更新を受け取る。やめるときは戻り値を呼ぶ。
 *
 * WebSocket で「更新があった」を受け取り、そのたびに onChange を呼ぶ。中身は呼ばれた側が
 * HTTP で取り直す（サーバーは送り先ごとに見せてよい情報を分けずに済む）。
 *
 * 繋がる前・切れている間は pollIntervalMs ごとに onChange を呼んで追いつく。
 * 切れたら待ち時間を倍にしながら（上限 30 秒）繋ぎ直す。
 */
export function subscribeRoomUpdates({
  url,
  roomId,
  onChange,
  pollIntervalMs = 5_000,
  createSocket = (u) => new WebSocket(u) as unknown as Socket,
}: RoomUpdatesOptions): () => void {
  let stopped = false;
  let socket: Socket | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let retryMs = FIRST_RETRY_MS;

  function startPolling() {
    poll ??= setInterval(onChange, pollIntervalMs);
  }

  function stopPolling() {
    if (poll !== null) clearInterval(poll);
    poll = null;
  }

  function connect(socketUrl: string) {
    socket = createSocket(`${socketUrl}?room=${encodeURIComponent(roomId)}`);
    socket.onopen = () => {
      retryMs = FIRST_RETRY_MS;
      stopPolling();
    };
    socket.onmessage = ({ data }) => {
      if (isChangeOf(data, roomId)) onChange();
    };
    socket.onclose = () => {
      if (stopped) return;
      // 切れている間に起きた更新を取りこぼさないよう、すぐ1回取り直す
      onChange();
      startPolling();
      retry = setTimeout(() => connect(socketUrl), retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };
  }

  startPolling();
  if (url) connect(url);

  return () => {
    stopped = true;
    stopPolling();
    if (retry !== null) clearTimeout(retry);
    socket?.close();
  };
}

function isChangeOf(data: string, roomId: string): boolean {
  try {
    const message = JSON.parse(data) as Partial<RoomChanged>;
    return message.type === "room-changed" && message.roomId === roomId;
  } catch {
    return false;
  }
}
