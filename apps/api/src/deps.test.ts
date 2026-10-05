import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createDepsFromEnv, TABLE_NAME_ENV, WS_ENDPOINT_ENV } from "./deps.js";
import { silentNotifier } from "./realtime/notifier.js";

const send = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>()),
  DynamoDBDocumentClient: { from: () => ({ send }) },
}));

function registerGuest() {
  return createApp().request("/api/guests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Alice" }),
  });
}

describe("環境変数からの依存の組み立て", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    send.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("テーブル名があればゲストを DynamoDB に保存する", async () => {
    vi.stubEnv(TABLE_NAME_ENV, "three-marks-app");
    send.mockResolvedValue({});

    const res = await registerGuest();

    expect(res.status).toBe(201);
    const command = send.mock.calls[0]![0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.TableName).toBe("three-marks-app");
  });

  it("テーブル名があればルームも同じテーブルに保存する", async () => {
    vi.stubEnv(TABLE_NAME_ENV, "three-marks-app");
    send.mockResolvedValue({});
    const app = createApp();
    // 登録はモックの DynamoDB に Put されるだけなので、認証のための Get で同じゲストを返す
    send.mockImplementation(async (command: { input: { Key?: { PK: string } } }) =>
      command instanceof GetCommand
        ? {
            Item: {
              PK: command.input.Key!.PK,
              guestId: "g-1",
              name: "Alice",
              createdAt: 0,
              expiresAt: Number.MAX_SAFE_INTEGER,
            },
          }
        : {}
    );

    const res = await app.request("/api/rooms", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });

    expect(res.status).toBe(201);
    const put = send.mock.calls.map(([c]) => c).find((c) => c instanceof PutCommand) as PutCommand;
    expect(put.input).toMatchObject({ TableName: "three-marks-app", Item: { SK: "ROOM" } });
  });

  it("テーブル名が無ければインメモリで動き、DynamoDB には触れない", async () => {
    vi.stubEnv(TABLE_NAME_ENV, "");

    const res = await registerGuest();

    expect(res.status).toBe(201);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("WebSocket の通知の組み立て", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("テーブル名と WebSocket の管理用エンドポイントがあれば、ルームの接続へ通知する", async () => {
    send.mockResolvedValue({ Items: [] });

    const { notifier } = createDepsFromEnv({
      [TABLE_NAME_ENV]: "three-marks-app",
      [WS_ENDPOINT_ENV]: "https://abc.execute-api.ap-northeast-1.amazonaws.com/ws",
    });
    await notifier.roomChanged("room-1");

    expect(notifier).not.toBe(silentNotifier);
    expect(send.mock.calls[0]![0].input).toMatchObject({
      TableName: "three-marks-app",
      ExpressionAttributeValues: { ":pk": "ROOM#room-1" },
    });
  });

  it.each([
    ["エンドポイントが無い", { [TABLE_NAME_ENV]: "three-marks-app" }],
    ["テーブル名も無い（ローカル開発）", {}],
  ])("%sときは通知しない", (_, env) => {
    expect(createDepsFromEnv(env).notifier).toBe(silentNotifier);
  });
});
