#!/bin/bash

set -e

AWS_REGION="${1:-us-east-1}"
AWS_PROFILE="${2:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$AWS_DIR")")"
DOCKERFILE_PATH="${PROJECT_ROOT}/wgeteer"

# Terraform 出力を一度に取得
cd "$AWS_DIR"
ECR_REPOSITORY_URI=$(terraform output -raw ecr_repository_uri 2>/dev/null || echo "")
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "")
SERVICE_NAME=$(terraform output -raw ecs_service_name 2>/dev/null || echo "")

if [ -z "$ECR_REPOSITORY_URI" ]; then
  echo "❌ エラー: ECR リポジトリ URI を取得できません"
  echo "   Terraform デプロイを先に実行してください: terraform apply"
  exit 1
fi

IMAGE_TAG="latest"
IMAGE_URI="${ECR_REPOSITORY_URI}:${IMAGE_TAG}"

echo "🔨 Docker イメージをビルド・プッシュしています..."
echo "  リポジトリ: ${ECR_REPOSITORY_URI}"
echo "  イメージタグ: ${IMAGE_TAG}"
echo "  AWS リージョン: ${AWS_REGION}"
echo ""

export AWS_PROFILE AWS_DEFAULT_REGION="${AWS_REGION}"

echo "🔐 ECR ログイン中..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REPOSITORY_URI%%/*}"

echo "🏗️  Docker イメージをビルド中..."
docker build \
  --network=host \
  --file "${DOCKERFILE_PATH}/Dockerfile.alpine" \
  --tag "${IMAGE_URI}" \
  --tag "${ECR_REPOSITORY_URI}:$(date +%Y%m%d-%H%M%S)" \
  "${DOCKERFILE_PATH}"

echo "📤 Docker イメージを ECR にプッシュ中..."
docker push "${IMAGE_URI}"

echo "🚀 ECS サービスを更新中..."
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
