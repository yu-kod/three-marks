# アプリのデータを入れる単一テーブル。
#
# 汎用キー名（PK / SK）にプレフィックス付きの値（USER#123、ROOM#ABC など）を入れる
# 単一テーブル設計（.claude/skills/coding-standards.md「DynamoDB データモデリング」）。
# GSI1 は逆引き用。GSI1PK を持たない項目は索引に載らない（スパースインデックス）ので、
# 使わない項目の書き込み費用は増えない。
resource "aws_dynamodb_table" "this" {
  name         = var.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    projection_type = "ALL"

    key_schema {
      attribute_name = "GSI1PK"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "GSI1SK"
      key_type       = "RANGE"
    }
  }

  # expiresAt（UNIX 秒）を持つ項目は期限を過ぎると自動で消える。
  # 削除は最大で数日遅れることがあるため、読むときにも期限を確認すること。
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }
}
