# Pengovr インフラストラクチャ (Terraform)

マルチクラウド対応の Terraform インフラストラクチャコードです。

## ディレクトリ構成

```
terraform/
├── aws/                  # AWS 用構成
│   ├── main.tf          # プロバイダー設定
│   ├── variables.tf     # 入力変数
│   ├── storage.tf       # S3、IAM などのリソース
│   ├── outputs.tf       # 出力値
│   ├── terraform.tfvars # 変数値
│   ├── .gitignore
│   └── README.md
├── gcp/                  # GCP 用構成 (将来対応)
├── azure/                # Azure 用構成 (将来対応)
└── README.md
```

## クラウドプロバイダー別のセットアップ

### AWS

```bash
cd terraform/aws
terraform init
terraform plan
terraform apply
```

詳細は [AWS README](./aws/README.md) を参照してください。

### その他のプロバイダー

GCP、Azure などの構成が追加される際の手順も同様です：

```bash
cd terraform/gcp   # または terraform/azure
terraform init
terraform plan
terraform apply
```

## 共通事項

- 各プロバイダーのディレクトリで独立した Terraform 状態を管理します
- 各ディレクトリで `terraform init` を実行してください
- `.gitignore` で秘密情報（アクセスキー、状態ファイル）を除外します
- 本番環境では リモート状態管理（各クラウドプロバイダー提供）の利用を推奨します

## リソース一覧

### AWS

- S3 バケット（ストレージ）
- IAM ユーザー（S3 アクセス用）
- IAM ロール（ECS タスク用）

### GCP（将来）

- Cloud Storage バケット
- サービスアカウント

### Azure（将来）

- Blob Storage アカウント
- ストレージアカウント

## ドキュメント

各クラウドプロバイダーの詳細ドキュメントは対応ディレクトリの README.md を参照してください。
