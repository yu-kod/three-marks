# アプリの構成。機能を足すときはここにモジュールを足す。

module "table" {
  source = "./modules/app-table"

  name = "${var.project_name}-app"
}

module "api" {
  source = "./modules/http-api"

  name       = "${var.project_name}-api"
  source_dir = "${path.module}/../apps/api/dist"

  environment = {
    APP_TABLE_NAME = module.table.name
  }

  policy_statements = [{
    Effect = "Allow"
    Action = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
    ]
    Resource = [module.table.arn, "${module.table.arn}/index/*"]
  }]
}

module "site" {
  source = "./modules/static-site"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name             = var.project_name
  api_domain       = module.api.api_domain
  domain_name      = var.domain_name
  hosted_zone_name = var.hosted_zone_name
}
