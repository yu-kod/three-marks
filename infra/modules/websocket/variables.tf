variable "name" {
  description = "Lambda 関数・WebSocket API・IAM ロールの名前"
  type        = string
}

variable "source_dir" {
  description = "Lambda に上げるビルド済みファイルのディレクトリ（apps/api/dist）"
  type        = string
}

variable "handler" {
  description = "Lambda のハンドラ（ファイル名.エクスポート名）"
  type        = string
  default     = "ws-lambda.handler"
}

variable "stage_name" {
  description = "ステージ名。接続先の URL の末尾になる（wss://.../<stage_name>）"
  type        = string
  default     = "ws"
}

variable "runtime" {
  description = "Lambda のランタイム。CI の Node バージョン（.nvmrc）と揃える"
  type        = string
  default     = "nodejs24.x"
}

variable "timeout" {
  description = "Lambda のタイムアウト（秒）。接続・切断の記録だけなので短くてよい"
  type        = number
  default     = 10
}

variable "memory_size" {
  description = "Lambda のメモリ（MB）"
  type        = number
  default     = 256
}

variable "environment" {
  description = "Lambda の環境変数。秘密情報は入れない（SSM Parameter Store から読む）"
  type        = map(string)
  default     = {}
}

variable "policy_statements" {
  description = "Lambda のロールに足す IAM ポリシーの Statement"
  type        = any
  default     = []
}

variable "log_retention_days" {
  description = "Lambda のログを残す日数"
  type        = number
  default     = 30
}

variable "throttling_burst_limit" {
  description = "接続・メッセージのバースト上限。想定外の大量アクセスで請求が膨らむのを防ぐ"
  type        = number
  default     = 100
}

variable "throttling_rate_limit" {
  description = "接続・メッセージの秒間上限"
  type        = number
  default     = 50
}
