variable "name" {
  description = "テーブル名"
  type        = string
}

variable "point_in_time_recovery" {
  description = "ポイントインタイムリカバリを有効にするか。失うと困るユーザーデータを持つなら true"
  type        = bool
  default     = false
}
