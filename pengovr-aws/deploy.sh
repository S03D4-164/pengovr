#!/bin/bash
set -e

ENV_FILE="../.env"

echo "🚀 Starting CDK deploy..."

MY_IP=$(curl -s https://checkip.amazonaws.com) cdk deploy -y 2>&1 | tee cdk.log

DEPLOY_OUTPUT=`cat cdk.log`

# 出力から各値を抽出
CONTAINER_IMAGE_URI=$(echo "$DEPLOY_OUTPUT" | grep "BuiltContainerImageUri" | awk -F '= ' '{print $2}' | xargs)
EC2_PUBLIC_IP=$(echo "$DEPLOY_OUTPUT" | grep "Ec2PublicIp" | awk -F '= ' '{print $2}' | xargs)
S3_ACCESS_KEY_ID=$(echo "$DEPLOY_OUTPUT" | grep "S3AccessKeyId" | awk -F '= ' '{print $2}' | xargs)
S3_SECRET_ACCESS_KEY=$(echo "$DEPLOY_OUTPUT" | grep "S3SecretAccessKeySecretName" | awk -F '= ' '{print $2}' | xargs)

# 抽出した値をログに表示
echo ""
echo "📦 Deploy completed. Extracted values:"
echo "  BuiltContainerImageUri: $CONTAINER_IMAGE_URI"
echo "  Ec2PublicIp: $EC2_PUBLIC_IP"
echo "  S3AccessKeyId: $S3_ACCESS_KEY_ID"
echo "  S3SecretAccessKey: ${S3_SECRET_ACCESS_KEY:0:10}***"

# 新しい値を追記
echo "" >> "$ENV_FILE"
echo "# AWS CDK Deploy Output ($(date))" >> "$ENV_FILE"
echo "EC2=$EC2_PUBLIC_IP" >> "$ENV_FILE"
echo "S3_ACCESS_KEY=$S3_ACCESS_KEY_ID" >> "$ENV_FILE"
echo "S3_SECRET_KEY=$S3_SECRET_ACCESS_KEY" >> "$ENV_FILE"
#echo "CONTAINER_IMAGE_URI=$CONTAINER_IMAGE_URI" >> "$ENV_FILE"

echo "✅ Updated $ENV_FILE with deployment outputs"
