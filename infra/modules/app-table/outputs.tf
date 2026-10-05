output "name" {
  description = "テーブル名（Lambda の環境変数 APP_TABLE_NAME に渡す）"
  value       = aws_dynamodb_table.this.name
}

output "arn" {
  description = "テーブルの ARN（IAM ポリシーで使う。索引は \"$${arn}/index/*\"）"
  value       = aws_dynamodb_table.this.arn
}
