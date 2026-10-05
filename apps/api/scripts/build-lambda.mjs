/**
 * Lambda 用に1ファイルへバンドルする。
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
  entryPoints: ["src/lambda.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: "dist/lambda.js",
});
await writeFile("dist/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
