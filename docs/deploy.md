# デプロイ

> AWS アカウントの準備（tfstate バケットと GitHub Actions のロール）は [yu-kod/app-template](https://github.com/yu-kod/app-template) の
> `infra/bootstrap/` で一元管理している。three-marks は `repositories` に登録済みのリポジトリとして、
> 下の「アプリを足す」の手順でロールを作る（作成済み。Secrets の登録は要らない）。
> 公開先は `https://three-marks.yu-web.site`（`infra/terraform.tfvars`）。

## 全体像

```
PR（infra/ を変えたとき）
  └─ .github/workflows/ci.yml の plan ジョブ
       ├─ OIDC で読み取り専用の plan ロールを引き受ける
       └─ 本番に対する terraform plan の差分を PR にコメントする

main へマージ
  └─ .github/workflows/deploy.yml（GitHub Environment: production）
       ├─ OIDC で deploy ロールを引き受ける（長期アクセスキーなし）
       ├─ npm run build:lambda   → apps/api/dist/lambda.js
       ├─ terraform apply        → S3 / CloudFront / API Gateway / Lambda / DynamoDB
       ├─ npm run build:web      → apps/web/dist/
       ├─ aws s3 sync            → フロントエンドを S3 へ
       ├─ CloudFront のキャッシュ無効化
       └─ /api/health を叩いて疎通確認
```

デプロイの履歴と URL は、リポジトリの **Environments → production** に残る。
テンプレートリポジトリ（`yu-kod/app-template`）自体はデプロイしない（deploy.yml は `is_template` なら何もしない）。

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

### state の置き場所

AWS アカウントで1つのバケット `tfstate-<アカウントID>-ap-northeast-1` に、リポジトリ名をキーにして置く
（`<リポジトリ名>/terraform.tfstate`）。バケット名はアカウント ID から決まるので、どこにも書き写さない。
ロックは S3 のネイティブロック（`use_lockfile`）で、DynamoDB のロックテーブルは使わない。

`infra/main.tf` の backend には bucket・key を書かず、GitHub Actions が init のときに渡す
（`.github/actions/terraform-init`）。テンプレートから作っても書き換え不要。

### GitHub Actions のロール

リポジトリごとに2つ。`infra/bootstrap/` が作る。

| ロール | 引き受けられるジョブ | 権限 |
|---|---|---|
| `gha-deploy-<repo>` | production 環境のジョブ（deploy.yml）だけ | AdministratorAccess（apply 用。意図的な妥協） |
| `gha-plan-<repo>` | PR のジョブだけ | ReadOnlyAccess（plan 用） |

**Secrets の登録は要らない。** ロールの ARN は `arn:aws:iam::<アカウントID>:role/gha-<deploy|plan>-<リポジトリ名>` と決まっているので、
ワークフロー（`.github/actions/aws-login`）が `.github/aws-account-id` とリポジトリ名から組み立てる。
アカウント ID は秘密情報ではない（AWS の見解）ので、リポジトリに書いてよい。
別のロールを使いたいときだけ、Secrets の `AWS_ROLE_ARN` / `AWS_PLAN_ROLE_ARN` で上書きできる。

PR のジョブは本番を書き換えられない。フォークからの PR には GitHub が OIDC トークンを出さない。

---

## AWS アカウントの準備（アカウントにつき1回）

tfstate のバケットと、GitHub Actions 用のロールを作る。**AWS マネジメントコンソールの CloudShell だけで完結する。**
CloudShell はコンソールにログインした権限がそのまま使われるため、アクセスキーの発行も `aws configure` も不要。

すでに準備済みのアカウントにアプリを足すだけなら、次の「アプリを足す」へ。

### 1. アカウントを確認する

**最初に必ず確認する。** 別のアカウントにログインしたまま進めると、そこにリソースが作られてしまう。

```bash
aws sts get-caller-identity
```

### 2. Terraform を入れる

CloudShell の `$HOME` は 1GB しかなく、AWS provider（数百MB）が入り切らない。Terraform 本体と provider は `/tmp` に置く。

```bash
curl -fsSLo /tmp/tf.zip https://releases.hashicorp.com/terraform/1.13.4/terraform_1.13.4_linux_amd64.zip
unzip -oq /tmp/tf.zip -d /tmp/tfbin
export PATH=/tmp/tfbin:$PATH
export TF_DATA_DIR=/tmp/tfdata
```

`PATH` と `TF_DATA_DIR` は `export` なので、CloudShell を開き直したら設定し直す。

### 3. tfstate のバケットを作る

```bash
git clone https://github.com/yu-kod/app-template.git ~/app-template
bash ~/app-template/infra/bootstrap/create-state-bucket.sh
```

`bucket: tfstate-<アカウントID>-ap-northeast-1` と出る。何度実行しても壊れない（既にあれば設定を揃えるだけ）。

### 4. ロールを作る

```bash
cd ~/app-template/infra/bootstrap
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
terraform init \
  -backend-config="bucket=tfstate-${ACCOUNT}-ap-northeast-1" \
  -backend-config="region=ap-northeast-1"
terraform apply
```

この構成の state もバケットに残る（`bootstrap/terraform.tfstate`）。CloudShell を閉じても、次に同じ手順で再実行できる。

GitHub の OIDC プロバイダーは、既にアカウントにあるものを参照する（yu-kod のアカウントには setnote などで作成済み）。
まだ無いアカウントでは `terraform apply -var create_github_oidc_provider=true` にする。
有無は `aws iam list-open-id-connect-providers` に `token.actions.githubusercontent.com` があるかで分かる。

### 5. アカウント ID をテンプレートに書く

最初の `aws sts get-caller-identity` の `Account`（12桁）を、`yu-kod/app-template` の `.github/aws-account-id` に書いて PR でマージする。
yu-kod のアカウントでは書き込み済み（`012502956603`）。

---

## アプリを足す

1. `yu-kod/app-template` の `infra/bootstrap/variables.tf` の `repositories` にリポジトリ名を足す（PR でマージ）
2. CloudShell で「AWS アカウントの準備」の 2・4 を再実行する（`git -C ~/app-template pull` してから）。
   増えるのは足したリポジトリのロールだけ
3. main へ push すればデプロイされる。手動で起動するなら Actions タブから Deploy を `workflow_dispatch` で実行する

Secrets の登録は要らない（テンプレートからコピーされた `.github/aws-account-id` から ARN を組み立てる）。
ロールを作る前にデプロイが走ると、ロールの引き受けで失敗する（ログに「repositories に入っているか確認」と出る）。

初回は CloudFront ディストリビューションの作成に 5〜10 分かかる。カスタムドメインなら、ACM 証明書の DNS 検証にさらに数分かかる。

---

## カスタムドメイン

アプリの設定は `infra/terraform.tfvars` に書く（秘密情報は書かない）。

```hcl
domain_name      = "<app>.yu-web.site"
hosted_zone_name = "yu-web.site"
```

yu-kod のアプリは、`yu-web.site` の Route 53 ホストゾーン（setnote で作成済み）にサブドメインをぶら下げている。
ACM 証明書（us-east-1）と Route 53 の検証レコード・A レコード（CloudFront への ALIAS）は Terraform が作る。

両方を空にすると CloudFront の既定ドメイン（`xxxxxxxx.cloudfront.net`）で公開する。

---

## 困ったとき

### デプロイが `Assuming role with OIDC` を繰り返して進まない

ロールの引き受けに失敗している。多いのは **`sub` クレームの形式**。リポジトリや owner を過去にリネームしていると、
`sub` が `repo:owner/repo:...` ではなく `repo:owner@ownerId/repo@repoId:...` という **ID 付きの形式**で届くことがある
（yu-kod/pusher-table と yu-kod/pop-art-trick で実際に起きた）。

CloudTrail で `AssumeRoleWithWebIdentity` の実際の `sub` を確認し、`infra/bootstrap/variables.tf` の
`extra_subject_prefixes` に足して再 apply する。

```hcl
extra_subject_prefixes = {
  "<repo>" = ["repo:yu-kod@48035533/<repo>@<repoId>"]
}
```

**ワイルドカードを広げて対処しないこと。** 似た名前の別リポジトリまで引き受けられてしまう。ID は以下で確認できる。

```bash
curl -s https://api.github.com/users/yu-kod | grep '"id"'
curl -s https://api.github.com/repos/yu-kod/<repo> | grep '"id"'
```

### PR に plan のコメントが付かない

テンプレート自身、Dependabot の PR、フォークからの PR では plan ジョブを飛ばす（Dependabot とフォークの PR には OIDC トークンが出ない）。
`.github/aws-account-id` が空でも飛ばす（ジョブの Summary に notice が出る）。

### Terraform のロックが残った

デプロイが途中で落ちると、state の横にロックファイル（`<repo>/terraform.tfstate.tflock`）が残ることがある。
エラーメッセージに出る Lock ID で解除する。

```bash
terraform -chdir=infra force-unlock <LOCK_ID>
```

### CloudFront に反映されない

キャッシュ無効化は deploy.yml が毎回行うが、反映まで数分かかる。ブラウザのキャッシュも疑うこと。

### 以前の方式（リポジトリごとの bootstrap）のアプリ

setnote・pusher-table・pop-art-trick は、リポジトリごとの tfstate バケットと DynamoDB のロックテーブルのまま。
この方式へ移すときは、`repositories` に足してロールを作り、state を
`terraform init -migrate-state -backend-config=...` で新しいバケットへ移す。
