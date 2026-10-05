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
    # ルームが変わったら WebSocket で知らせる（apps/api/src/deps.ts）
    WS_MANAGEMENT_ENDPOINT = module.ws.management_endpoint
  }

  policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
      ]
      Resource = [module.table.arn, "${module.table.arn}/index/*"]
    },
    {
      Effect   = "Allow"
      Action   = ["execute-api:ManageConnections"]
      Resource = [module.ws.connections_arn]
    },
  ]
}

# ルームの更新を受け取る WebSocket（接続の記録だけを行う）
module "ws" {
  source = "./modules/websocket"

  name       = "${var.project_name}-ws"
  source_dir = "${path.module}/../apps/api/dist"

  environment = {
    APP_TABLE_NAME = module.table.name
  }

  # 接続の記録（2つの項目を一緒に書く・消す）と、接続するルームがあるかの確認
  policy_statements = [{
    Effect = "Allow"
    Action = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    Resource = [module.table.arn]
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
