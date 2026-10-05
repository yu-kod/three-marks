/**
 * Lambda のエントリポイント（API Gateway HTTP API）。
 *
 * アプリの組み立ては createApp() に閉じてあるので、ローカル開発と同じアプリをそのまま動かす。
 */
import { handle } from "hono/aws-lambda";
import { createApp } from "./app.js";

export const handler = handle(createApp());
