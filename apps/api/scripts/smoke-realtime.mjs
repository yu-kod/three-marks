/**
 * 本番で、ルームの更新が WebSocket で届くかを確かめる（deploy.yml から呼ぶ）。
 *
 *   1. ゲストを2人作り、1人がルームを作る
 *   2. そのルームの WebSocket に繋ぐ
 *   3. もう1人が参加する → 「room-changed」が届けば成功
 *
 * 作ったゲストとルームは期限（TTL）で消える。Node 22 以降の組み込みの fetch と WebSocket を使う。
 */
const { APP_URL, WS_URL } = process.env;
if (!APP_URL || !WS_URL) {
  console.error("APP_URL と WS_URL が要る");
  process.exit(1);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** 繋がるまで待つ。デプロイ直後は WebSocket API の反映を待つことがあるので何度か試す */
async function connect(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const socket = new WebSocket(url);
    const opened = await new Promise((resolve) => {
      socket.onopen = () => resolve(true);
      socket.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 10_000);
    });
    if (opened) return socket;
    socket.close();
    console.log(`connect attempt ${attempt} failed; retrying in 5s`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error(`WebSocket に繋がらない: ${url}`);
}

const host = await api("POST", "/api/guests", { body: { name: "smoke-host" } });
const guest = await api("POST", "/api/guests", { body: { name: "smoke-guest" } });
const { room } = await api("POST", "/api/rooms", { token: host.token });

const socket = await connect(`${WS_URL}?room=${encodeURIComponent(room.id)}`);
const received = new Promise((resolve, reject) => {
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.type === "room-changed" && message.roomId === room.id) resolve();
  };
  setTimeout(() => reject(new Error("10 秒待っても room-changed が届かない")), 10_000);
});

await api("POST", `/api/rooms/${room.id}/join`, { token: guest.token });
await received;
socket.close();
console.log("realtime smoke test passed");
