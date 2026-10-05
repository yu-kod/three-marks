terraform {
  required_version = ">= 1.10"

  # state はアカウントで1つのバケット（infra/bootstrap/create-state-bucket.sh が作る）に、
  # リポジトリ名をキーにして置く。bucket・key・region は init のときに -backend-config で渡すので
  # ここには書かない（テンプレートから作っても書き換え不要）。
  #   terraform init \
  #     -backend-config="bucket=tfstate-<アカウントID>-ap-northeast-1" \
  #     -backend-config="key=<リポジトリ名>/terraform.tfstate" \
  #     -backend-config="region=ap-northeast-1"
  # ロックは S3 のネイティブロック（DynamoDB のロックテーブルは使わない）。
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}

# CloudFront が使う ACM 証明書は us-east-1 にしか置けない
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
