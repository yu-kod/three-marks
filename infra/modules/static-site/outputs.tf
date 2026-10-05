output "url" {
  description = "アプリの URL"
  value       = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "bucket_name" {
  description = "ビルドしたフロントエンドを同期する S3 バケット"
  value       = aws_s3_bucket.this.id
}

output "distribution_id" {
  description = "キャッシュ無効化に使う CloudFront ディストリビューション ID"
  value       = aws_cloudfront_distribution.this.id
}
