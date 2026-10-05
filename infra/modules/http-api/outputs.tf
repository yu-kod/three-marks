output "api_endpoint" {
  description = "API Gateway の URL（https://xxxx.execute-api.<region>.amazonaws.com）"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "api_domain" {
  description = "CloudFront のオリジンに指定するドメイン"
  value       = replace(aws_apigatewayv2_api.this.api_endpoint, "https://", "")
}

output "function_name" {
  description = "Lambda 関数名"
  value       = aws_lambda_function.this.function_name
}

output "role_name" {
  description = "Lambda の IAM ロール名。モジュールの外から権限を足すときに使う"
  value       = aws_iam_role.lambda.name
}
