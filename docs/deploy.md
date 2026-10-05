# デプロイ

## 全体像

```
main へ push
  └─ .github/workflows/deploy.yml
       ├─ OIDC で AWS のロールを引き受ける（長期アクセスキーなし）
       ├─ npm run build:lambda   → apps/api/dist/lambda.js
       ├─ terraform apply        → S3 / CloudFront / API Gateway / Lambda / DynamoDB
       ├─ npm run build:web      → apps/web/dist/
       ├─ aws s3 sync            → フロントエンドを S3 へ
       ├─ CloudFront のキャッシュ無効化
       └─ /api/health を叩いて疎通確認
```

## 構成

| リソース | 役割 |
|---|---|
| S3 | フロントエンドの静的ファイル。公開せず CloudFront の OAC 経由でのみ読ませる |
| CloudFront | 配信。`/api/*` は API Gateway、それ以外は S3 へ振り分ける |
| CloudFront Function | SPA のルーティング用。拡張子のないパスは `index.html` を返す |
| API Gateway (HTTP API) | `$default` ルートですべて Lambda へ流す（ルーティングは Hono 側） |
| Lambda | `hono/aws-lambda` の `handle()` で Hono アプリをそのまま動かす（arm64） |
| DynamoDB | アプリのデータを入れる単一テーブル（PK / SK + GSI1 + TTL） |

フロントエンドは同一オリジンの `/api/...` を叩けばよく、API の URL をビルドに埋め込む必要はない。

Terraform はモジュールに分けてある（`infra/modules/`）。アプリの構成は `infra/app.tf` で組み合わせる。

| モジュール | 作るもの |
|---|---|
| `static-site` | S3 + CloudFront（+ カスタムドメインなら ACM と Route 53） |
| `http-api` | Lambda + API Gateway HTTP API + IAM ロール + ロググループ |
| `app-table` | DynamoDB の単一テーブル |

テンプレートリポジトリ（`yu-kod/app-template`）自体はデプロイしない。deploy.yml は
`is_template` のリポジトリでは何もしない。

---

## 初回だけ必要な作業

### 1. ブートストラップ（PC 不要）

tfstate の置き場所と、GitHub Actions が引き受けるロールを作る。**AWS マネジメントコンソールの CloudShell だけで完結する。**

CloudShell はコンソールにログインした権限がそのまま使われるため、アクセスキーの発行も `aws configure` も不要。

#### 1-1. アカウントを確認する

**最初に必ず確認する。** 会社用など別のアカウントにログインしたまま apply すると、そこにリソースが作られてしまう。

```bash
aws sts get-caller-identity
```

意図したアカウントでなければ、コンソールでログインし直してから CloudShell を開く。

> なお、IP 制限などの Deny ポリシーが付いたアカウントでは CloudShell から IAM を操作できない。
> CloudShell からの API 呼び出しの送信元 IP は AWS 側のアドレスになるため、社内 IP を条件にした
> ポリシーに一致しない。その場合はこの手順では進められない。

#### 1-2. OIDC プロバイダーの有無を確認する

GitHub Actions 用の OIDC プロバイダーは **AWS アカウントに1つしか作れない**。同じアカウントで他のプロジェクトが既に GitHub Actions から OIDC を使っていれば、既存のものを参照する必要がある。

```bash
aws iam list-open-id-connect-providers
```

出力に `token.actions.githubusercontent.com` が含まれていれば、後の apply に
`-var create_github_oidc_provider=false` を付ける。

#### 1-3. Terraform を入れて apply する

**CloudShell の `$HOME` は 1GB しかなく、AWS provider のバイナリ（数百MB）が入り切らずに
`no space left on device` になる。** provider の展開先を `/tmp` に逃がす（`/` には数GBの空きがある）。

```bash
# terraform を /tmp に入れる（$HOME を消費しない）
curl -fsSLo /tmp/tf.zip https://releases.hashicorp.com/terraform/1.13.4/terraform_1.13.4_linux_amd64.zip
unzip -oq /tmp/tf.zip -d /tmp/tfbin
export PATH=/tmp/tfbin:$PATH

# provider の展開先も /tmp にする
export TF_DATA_DIR=/tmp/tfdata

# リポジトリは $HOME に置く。apply が途中で失敗したときに
# terraform.tfstate を残して再開できるようにするため
git clone https://github.com/<owner>/<repo>.git ~/<repo>
cd ~/<repo>/infra/bootstrap

terraform init

# project_name は infra/variables.tf の project_name と揃える
VARS="-var project_name=<project> -var github_repo=<owner>/<repo>"

# 1-2 で既存の OIDC プロバイダーが見つかった場合
terraform apply $VARS -var create_github_oidc_provider=false

# 見つからなかった場合
terraform apply $VARS
```

`PATH` と `TF_DATA_DIR` は `export` なので、セッションを開き直したら設定し直す。
`/tmp` の中身も消えるが、ブートストラップは一度きりなので問題ない。

#### 1-4. 途中で失敗した場合

apply が途中で止まっても、作成済みのリソースは `terraform.tfstate` に記録されている。
原因を直して**同じディレクトリで再実行すれば続きから完了する**。作り直されることはない。

よくある失敗:

```
Error: creating IAM OIDC Provider: ... EntityAlreadyExists:
Provider with url https://token.actions.githubusercontent.com already exists.
```

1-2 の確認を飛ばしたときに起きる。`-var create_github_oidc_provider=false` を付けて再実行する。

#### 1-5. 出力

apply が終わると3つの値が出力される。

```
github_actions_role_arn = "arn:aws:iam::123456789012:role/<project>-github-actions"
tfstate_bucket          = "<project>-tfstate"
tfstate_lock_table      = "<project>-tfstate-lock"
```

`tfstate_bucket` と `tfstate_lock_table` が `infra/main.tf` の `backend "s3"` と一致していることを確認する。

このディレクトリに残る `terraform.tfstate` は捨ててよい。作られるリソースは `prevent_destroy` 済みで、以後この構成を変えることはほぼない。

### 2. GitHub の Secrets に登録

リポジトリの Settings → Secrets and variables → Actions で登録する。

| 名前 | 値 |
|---|---|
| `AWS_ROLE_ARN` | 上で出力された `github_actions_role_arn` |

**これだけ。** アクセスキーもシークレットキーも登録しない。GitHub Actions は OIDC で一時認証情報を得るため、長期の認証情報はどこにも存在しない。

### 3. デプロイ

`main` へ push すれば走る。手動で起動する場合は Actions タブから Deploy workflow を `workflow_dispatch` で実行する。

初回は CloudFront ディストリビューションの作成に 5〜10 分かかる。

---

## カスタムドメイン

既定ではカスタムドメインを使わず、CloudFront の既定ドメイン（`xxxxxxxx.cloudfront.net`）で公開する。

ドメインで公開するときは `infra/variables.tf` の既定値を変える。yu-kod のアプリは
`yu-web.site` の Route 53 ホストゾーン（setnote で作成済み）にサブドメインをぶら下げている。

```hcl
domain_name      = "<app>.yu-web.site"
hosted_zone_name = "yu-web.site"
```

ACM 証明書（us-east-1）と Route 53 の検証レコード・A レコード（CloudFront への ALIAS）は
Terraform が自動で作る。**初回の apply は証明書の DNS 検証が通るまで数分かかる。**

### ドメインを使わない場合

`domain_name` を空文字にすると CloudFront の既定ドメイン（`xxxxxxxx.cloudfront.net`）で公開し、
ACM 証明書と Route 53 のレコードを作らない。ドメインを用意していない環境でもデプロイできる。

---

## 困ったとき

### デプロイが `Assuming role with OIDC` を繰り返して進まない

`Configure AWS credentials` のステップが `Assuming role with OIDC` を何度も出して止まる場合、
ロールの引き受けに失敗してリトライしている。

原因として多いのは、**`sub` クレームの形式**。リポジトリや owner を過去にリネームしていると、
GitHub が発行する OIDC トークンの `sub` が通常形式ではなく
`repo:owner@ownerId/repo@repoId:...` という **ID 付きの形式**になることがある。

CloudTrail で `AssumeRoleWithWebIdentity` の実際の `sub` を確認し、`infra/bootstrap/main.tf` の
`extra_assume_role_subs` に足して再 apply する（yu-kod/pusher-table と yu-kod/pop-art-trick で実際に起きた）。

```bash
cd ~/<repo> && git pull
cd infra/bootstrap
terraform apply $VARS -var create_github_oidc_provider=false \
  -var 'extra_assume_role_subs=["repo:yu-kod@48035533/<repo>@<repoId>:*"]'
```

**ワイルドカードを広げて対処しないこと。** `repo:yu-kod*/<repo>*:*` のようなパターンは
`yu-kod-foo/<repo>-bar` のような別リポジトリまで引き受けられてしまう。ID を明示したパターンを並べる。

ID は以下で確認できる。

```bash
# owner id
curl -s https://api.github.com/users/yu-kod | grep '"id"'
# repo id
curl -s https://api.github.com/repos/yu-kod/<repo> | grep '"id"'
```

### Terraform のロックが残った

デプロイが途中で落ちるとロックが残ることがある。エラーメッセージに出る Lock ID を使って解除する。

```bash
terraform -chdir=infra force-unlock <LOCK_ID>
```

### CloudFront に反映されない

キャッシュ無効化は deploy.yml が毎回行うが、反映まで数分かかる。ブラウザのキャッシュも疑うこと。
