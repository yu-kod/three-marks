variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "リソース名の接頭辞。GitHub Actions がリポジトリ名を渡す（-var project_name=...）"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,40}$", var.project_name))
    error_message = "小文字・数字・ハイフンで、リソース名に使える長さにする。"
  }
}

variable "domain_name" {
  description = <<-DESC
    公開するカスタムドメイン。

    空文字にすると CloudFront の既定ドメインで公開し、ACM 証明書と Route 53 の
    レコードを作らない。ドメインを用意していない段階ではこちらで始められる。
    値を入れる場合は hosted_zone_name も指定すること。
  DESC
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "domain_name を管理している Route 53 ホストゾーン名"
  type        = string
  default     = ""
}
