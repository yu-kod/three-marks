terraform {
  required_version = ">= 1.9"

  # infra/bootstrap で作ったバケットとロックテーブルを指す。
  # backend には変数を使えないため直書きする。テンプレートから作ったら名前を置き換える
  # （docs/deploy.md「テンプレートから作ったら」）。
  backend "s3" {
    bucket         = "three-marks-tfstate"
    key            = "terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "three-marks-tfstate-lock"
    encrypt        = true
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
