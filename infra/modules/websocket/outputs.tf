output "url" {
  description = "クライアントが繋ぐ URL（wss://xxxx.execute-api.<region>.amazonaws.com/<stage>）"
  value       = aws_apigatewayv2_stage.this.invoke_url
}

output "management_endpoint" {
  description = "接続へ送るための管理用エンドポイント（https://...）。送る側の Lambda に渡す"
  value       = replace(aws_apigatewayv2_stage.this.invoke_url, "wss://", "https://")
}

output "connections_arn" {
  description = "送る側の Lambda に許す execute-api:ManageConnections の対象"
  value       = "${aws_apigatewayv2_api.this.execution_arn}/${aws_apigatewayv2_stage.this.name}/POST/@connections/*"
}

output "function_name" {
  description = "Lambda 関数名"
  value       = aws_lambda_function.this.function_name
}
