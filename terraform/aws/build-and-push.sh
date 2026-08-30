#!/bin/bash

# Terraform で作成した ECR にイメージをビルド・プッシュするスクリプト
# 使用方法: ./build-and-push.sh [AWS_REGION] [AWS_PROFILE]

set -e

# 変数
AWS_REGION="${1:-us-east-1}"
AWS_PROFILE="${2:-default}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKERFILE_PATH="${PROJECT_ROOT}/wgeteer"

# Terraform の出力から ECR リポジトリ URI を取得
ECR_REPOSITORY_URI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && terraform output -raw ecr_repository_uri 2>/dev/null || echo "")

if [ -z "$ECR_REPOSITORY_URI" ]; then
  echo "❌ エラー: ECR リポジトリ URI を取得できません"
  echo "   Terraform デプロイを先に実行してください: terraform apply"
  exit 1
fi

REPOSITORY_NAME="${ECR_REPOSITORY_URI##*/}"
IMAGE_TAG="latest"
IMAGE_URI="${ECR_REPOSITORY_URI}:${IMAGE_TAG}"

echo "🔨 Docker イメージをビルド・プッシュしています..."
echo "  リポジトリ: ${ECR_REPOSITORY_URI}"
echo "  イメージタグ: ${IMAGE_TAG}"
echo "  AWS リージョン: ${AWS_REGION}"
echo ""

# AWS CLI プロファイルを設定
export AWS_PROFILE
export AWS_DEFAULT_REGION="${AWS_REGION}"

# ECR ログイン
echo "🔐 ECR ログイン中..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REPOSITORY_URI%%/*}"

# Docker イメージをビルド
echo "🏗️  Docker イメージをビルド中..."
docker build \
  --network=host \
  --file "${DOCKERFILE_PATH}/Dockerfile.alpine" \
  --tag "${IMAGE_URI}" \
  --tag "${ECR_REPOSITORY_URI}:$(date +%Y%m%d-%H%M%S)" \
  "${DOCKERFILE_PATH}"

# Docker イメージを ECR にプッシュ
echo "📤 Docker イメージを ECR にプッシュ中..."
docker push "${IMAGE_URI}"

# 新しいデプロイを強制
echo "🚀 ECS サービスを更新中..."
CLUSTER_NAME=$(cd "$(dirname "${BASH_SOURCE[0]}")" && terraform output -raw ecs_cluster_name 2>/dev/null || echo "")
SERVICE_NAME=$(cd "$(dirname "${BASH_SOURCE[0]}")" && terraform output -raw ecs_service_name 2>/dev/null || echo "")

if [ -n "$CLUSTER_NAME" ] && [ -n "$SERVICE_NAME" ]; then
  aws ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --force-new-deployment \
    --region "${AWS_REGION}"
  echo "✅ ECS サービスが更新されました"
else
  echo "⚠️  ECS クラスター/サービス名を取得できませんでした"
  echo "   手動で以下を実行してください:"
  echo "   aws ecs update-service --cluster pengovr-cluster --service pengovr-worker-service --force-new-deployment --region ${AWS_REGION}"
fi

echo ""
echo "✨ 完了しました!"
echo "  イメージ URI: ${IMAGE_URI}"
