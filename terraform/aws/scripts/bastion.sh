#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_DIR="$(dirname "$SCRIPT_DIR")"

EC2=${1:-$(cd "$AWS_DIR" && terraform output -raw cache_instance_public_ip 2>/dev/null)}
KEY_PATH=$(cd "$AWS_DIR" && terraform output -raw ec2_private_key_path 2>/dev/null)

if [ -z "$EC2" ] || [ -z "$KEY_PATH" ]; then
    echo "エラー: EC2 IP または秘密鍵パスを取得できませんでした"
    echo "usage: $0 [public ip]"
    exit 1
fi

ssh -4 -i "$KEY_PATH" -L 6379:127.0.0.1:6379 ec2-user@$EC2
