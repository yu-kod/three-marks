output "app_url" {
  description = "アプリの URL"
  value       = module.site.url
}

output "frontend_bucket_name" {
  description = "フロントエンドを同期する S3 バケット名"
  value       = module.site.bucket_name
}

output "cloudfront_distribution_id" {
  description = "キャッシュ無効化に使う CloudFront ディストリビューション ID"
  value       = module.site.distribution_id
}

output "api_endpoint" {
  description = "HTTP API のエンドポイント（CloudFront を介さない直接の URL）"
  value       = module.api.api_endpoint
}

output "lambda_function_name" {
  description = "API の Lambda 関数名"
  value       = module.api.function_name
}

output "app_table_name" {
  description = "アプリの DynamoDB テーブル名"
  value       = module.table.name
}

output "websocket_url" {
  description = "クライアントが繋ぐ WebSocket の URL。フロントエンドのビルドに渡す（VITE_WS_URL）"
  value       = module.ws.url
}
