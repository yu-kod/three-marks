variable "name" {
  description = "リソース名の接頭辞"
  type        = string
}

variable "api_domain" {
  description = "/api/* を流す先のドメイン（http-api モジュールの api_domain）。空なら静的配信だけ"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "公開するカスタムドメイン。空なら CloudFront の既定ドメインで公開する"
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "domain_name を管理している Route 53 ホストゾーン名（domain_name を指定するときだけ必要）"
  type        = string
  default     = ""

  validation {
    condition     = var.domain_name == "" || var.hosted_zone_name != ""
    error_message = "domain_name を指定するときは hosted_zone_name も指定する。"
  }
}

variable "price_class" {
  description = "CloudFront の価格クラス。PriceClass_200 は日本を含む"
  type        = string
  default     = "PriceClass_200"
}
