#!/bin/bash

# Terraform バックエンド S3 バケットとセットアップスクリプト
# terraform init の前に実行してください

set -e

BUCKET_NAME="pengovr-terraform-state-dev"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_DIR="$(dirname "$SCRIPT_DIR")"
TFVARS_FILE="$AWS_DIR/terraform.tfvars"

echo "=========================================="
echo "Terraform バックエンド セットアップスクリプト"
echo "=========================================="
echo ""

# 1. 自分の IP アドレスを取得
echo "1. 自分の IP アドレスを取得しています..."
MY_IP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')

if [ -z "$MY_IP" ]; then
    echo "エラー: IP アドレスの取得に失敗しました"
    echo "手動で以下を実行してください:"
    echo "  MY_IP=your.ip.address.here"
    exit 1
fi

echo "   取得した IP アドレス: $MY_IP"
echo ""

# 2. S3 バケットが既に存在するかチェック
echo "2. S3 バケットの存在確認をしています..."
if aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "   バケットが見つかりません。作成しています..."
    
    aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
    echo "   ✓ S3 バケット '$BUCKET_NAME' を作成しました"
    
    # バージョニング有効化
    echo "   バージョニングを有効化しています..."
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled \
        --region "$REGION"
    echo "   ✓ バージョニングを有効化しました"
    
    # サーバー側暗号化を有効化
    echo "   サーバー側暗号化を有効化しています..."
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }
            ]
        }' \
        --region "$REGION"
    echo "   ✓ サーバー側暗号化を有効化しました"
    
    # ブロックパブリックアクセス
    echo "   パブリックアクセスをブロックしています..."
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        --region "$REGION"
    echo "   ✓ パブリックアクセスをブロックしました"
else
    echo "   ✓ S3 バケット '$BUCKET_NAME' は既に存在します"
fi

echo ""

# 3. terraform.tfvars を更新
echo "3. terraform.tfvars を更新しています..."

if [ -f "$TFVARS_FILE" ]; then
    # 既存の my_ip 行を置き換える
    if grep -q '^my_ip' "$TFVARS_FILE"; then
        sed -i.bak "s/^my_ip = .*/my_ip = \"$MY_IP\"/" "$TFVARS_FILE"
        echo "   ✓ terraform.tfvars の my_ip を更新しました"
        rm -f "$TFVARS_FILE.bak"
    else
        echo "my_ip = \"$MY_IP\"" >> "$TFVARS_FILE"
        echo "   ✓ terraform.tfvars に my_ip を追加しました"
    fi
else
    echo "エラー: $TFVARS_FILE が見つかりません"
    echo "terraform.tfvars.example から $TFVARS_FILE を作成してください"
    exit 1
fi

echo ""
echo "=========================================="
echo "✓ セットアップが完了しました"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "  cd $AWS_DIR"
echo "  terraform init"
echo ""
