# three-marks

ダーツのクリケットを題材にした、2〜4人用のオンラインカードゲーム。
手札と公開札から山札の中身を読み、狙う数字を選んで「投げる」。

ルールは [docs/spec.md](docs/spec.md)、デプロイは [docs/deploy.md](docs/deploy.md) を参照。
土台は [yu-kod/app-template](https://github.com/yu-kod/app-template)（[docs/template.md](docs/template.md)）。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Hono + TypeScript + DynamoDB（Lambda） |
| Infra | Terraform（S3 + CloudFront + API Gateway + Lambda + DynamoDB） |
| テスト | Vitest（カバレッジ 100%） |
| CI/CD | GitHub Actions（OIDC で AWS へデプロイ） |

## 構成

```
apps/
  api/          — Hono API（Lambda / ローカルサーバー）
  web/          — React SPA
packages/       — アプリをまたいで再利用する部品
  server-core/  — エラー、構造化ログ、入力検証、DynamoDB クライアント
  web-core/     — API クライアント、安全な localStorage
  identity/     — ゲスト認証（名前登録とゲストトークン）
  identity-client/ — ブラウザ側のゲストセッションと React のフック
infra/
  modules/      — static-site / http-api / app-table
docs/           — 仕様書・設計書・デプロイ手順
```

## 開発

```bash
npm install
npm run dev     # api (3001) + web (5173) を同時起動。web は /api を api へプロキシする
```

## テスト・検査

```bash
npm run check   # lint / format:check / typecheck / test をまとめて
npm test        # 全ワークスペースのテスト（カバレッジ 100% を下回ると失敗）
```

## デプロイ

`main` へのマージで GitHub Actions がデプロイする。初回だけ必要な作業は [docs/deploy.md](docs/deploy.md)。
