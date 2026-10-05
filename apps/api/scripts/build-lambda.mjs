/**
 * Lambda 用にエントリポイントごと1ファイルへバンドルする。
 *   lambda.js    — HTTP API（Hono）
 *   ws-lambda.js — WebSocket API（接続の記録）
 * 2つは同じ zip に入り、Terraform がハンドラ名で使い分ける。
 *
 * AWS SDK も含めて固める。ランタイム同梱の SDK に頼ると、入っているクライアントが
 * ランタイムの更新に左右されるため。
 *
 * このワークスペースは "type": "module" なので、CommonJS の出力が ESM と誤認されないよう
 * dist/ に package.json を置いて明示する（Lambda へ上げる zip にもこれが入る）。
 */
import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

await build({
  entryPoints: ["src/lambda.ts", "src/ws-lambda.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outdir: "dist",
});
await writeFile("dist/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
