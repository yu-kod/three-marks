---
name: pr-merge
description: >
  PRを作成し、GitHub Auto-mergeを有効化する。
  CIが通れば自動マージされる。実装完了後にこのスキルを呼び出す。
triggers:
  - PRを作成
  - マージして
  - PRにして
  - レビューしてマージ
---

# PR作成 → Auto-merge スキル

実装完了後、以下の手順でPRを作成する。
CIが通れば GitHub Auto-merge により自動的にマージされる。

---

## 手順

### 1. コミット & プッシュ

- 未コミットの変更があればコミットする
- コミット subject 末尾に対応する Issue 番号を `(#N)` で入れる
- リモートにプッシュする: `git push -u origin <branch-name>`

### 2. PR作成

- GitHub MCP ツール (`mcp__github__create_pull_request`) でPRを作成する
- PRテンプレートがあれば従う
- タイトルは70文字以内、本文に変更の要約を含める
- **本文に `Closes #N` を書き、マージで対応 Issue が自動クローズされるようにする**

### 3. Auto-merge を有効化

- `mcp__github__enable_pr_auto_merge` でAuto-mergeを有効化する（merge commit方式）
- これによりCIが通った時点で自動マージされる

### 4. 完了

- PRのURLをユーザーに報告する
- マージを待つ必要はない（CIパスで自動マージされる）

---

## 注意事項

- GitHub リポジトリ設定で「Allow auto-merge」が有効であること
- ブランチルールセットで必須ステータスチェックが設定されていること
- マージ後のブランチは、リポジトリの設定「Automatically delete head branches」（Settings → General → Pull Requests）で GitHub が消す。
  **この設定は作業者からは変えられない。** 新しいリポジトリでは、オンになっているかを利用者に確かめてもらう
- マージ後に `mcp__github__list_branches` でブランチが消えたことを確かめる。残っていたら設定を確かめてもらい、
  残ったものは Actions の「Delete merged branches」を手で実行して片付けてもらう（作業者の環境からはブランチを消せない）
