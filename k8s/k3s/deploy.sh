#!/bin/bash

set -e

echo "🚀 Deploying PengoVR Hybrid Setup (Local Components) to k3s..."

# 使用するコマンドの定義 (minikubeとの競合を避けるためフルパスまたはk3s経由)
KUBECTL="sudo k3s kubectl"
KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

# k3sの稼働確認
if ! $KUBECTL cluster-info >/dev/null 2>&1; then
    echo "❌ k3s is not running. Please start k3s first: sudo systemctl start k3s"
    exit 1
fi

echo "✅ k3s cluster is running"

WORKER_NODE_IP=$(hostname -I | awk '{print $1}')
# ワーカーノードの外部IPアドレスを取得または入力
# 環境変数から取得するか、デフォルト値を使用
if [ "$PENGVR_WORKER_NODE_IP" ]; then
    WORKER_NODE_IP="$PENGVR_WORKER_NODE_IP"
fi
echo "📡 Using k3s-worker IP address: $WORKER_NODE_IP"

# イメージの確認とインポート
echo "🔍 Checking and Importing local images..."
REQUIRED_IMAGES=("pengovr-api:latest" "pengovr-ui:latest")

# 最後にインポートしたイメージIDを記録するディレクトリ
CACHE_DIR="$HOME/.pengovr_cache"
mkdir -p "$CACHE_DIR"

for image in "${REQUIRED_IMAGES[@]}"; do
    # 1. ホストDocker側のイメージIDを取得
    DOCKER_ID=$(docker inspect --format='{{.Id}}' "$image" 2>/dev/null || echo "")
    
    if [ -z "$DOCKER_ID" ]; then
        echo "❌ Required image not found in Docker: $image"
        echo "Please build images first:"
        echo "  docker build -t pengovr-api:latest -f ../../api/Dockerfile.alpine ../../"
        echo "  docker build -t pengovr-ui:latest -f ../../ui/Dockerfile.alpine ../../"
        exit 1
    fi

    # 2. 前回インポートした時のIDを取得
    CACHE_FILE="$CACHE_DIR/${image//\//_}.id"
    LAST_ID=$(cat "$CACHE_FILE" 2>/dev/null || echo "")

    # 3. 比較して必要ならインポート
    if [ "$DOCKER_ID" == "$LAST_ID" ]; then
        echo "✅ $image is up to date in k3s. Skipping import."
    else
        echo "📥 Importing $image to k3s (containerd)..."
        docker save "$image" | sudo k3s ctr -n k8s.io images import -
        # インポート成功後にIDを記録
        echo "$DOCKER_ID" > "$CACHE_FILE"
        
        # 再起動フラグ
        if [ "$image" == "pengovr-api:latest" ]; then UPDATE_API=true; fi
        if [ "$image" == "pengovr-ui:latest" ]; then UPDATE_UI=true; fi
    fi
done

# Namespace作成
echo "📦 Creating namespace..."
$KUBECTL apply -f ../namespace.yaml

$KUBECTL apply -f secret.yaml
# 各リソースのデプロイ
echo "⚙️  Applying manifests..."
# configmap.yamlにWORKER_NODE_IPを適用
#sed "s/YOUR_WORKER_NODE_EXTERNAL_IP/$WORKER_NODE_IP/g" configmap.yaml | $KUBECTL apply -f -
$KUBECTL apply -f configmap.yaml
$KUBECTL apply -f mongodb.yaml

echo "⏳ Waiting for Local MongoDB..."
$KUBECTL wait --for=condition=ready pod -l app=mongo --timeout=300s -n pengovr

echo "🌐 Deploying API and UI..."
$KUBECTL apply -f api-deployment.yaml
$KUBECTL apply -f ui-deployment.yaml

# Ingress / NodePort
echo "🚪 Deploying access points..."
$KUBECTL apply -f services-nodeport.yaml
$KUBECTL apply -f ingress.yaml

# 強制再起動 (イメージが更新された場合のみ)
if [ "$UPDATE_API" == "true" ]; then
    echo "♻️  Restarting API to reflect changes..."
    $KUBECTL rollout restart deployment/api -n pengovr
fi

if [ "$UPDATE_UI" == "true" ]; then
    echo "♻️  Restarting UI to reflect changes..."
    $KUBECTL rollout restart deployment/ui -n pengovr
fi

echo "⏳ Waiting for API and UI to be ready..."
$KUBECTL wait --for=condition=available --timeout=60s deployment/api -n pengovr || echo "⚠️ API is not ready yet"
$KUBECTL wait --for=condition=available --timeout=60s deployment/ui -n pengovr || echo "⚠️ UI is not ready yet"

echo "✅ Deployment complete!"
echo "🔍 Check status: $KUBECTL get pods -n pengovr"
echo "🔌 Access UI (NodePort): http://${WORKER_NODE_IP}:30001 (or http://localhost:30001)"
echo "🌐 Access UI (Ingress):  http://pengovr.local (Requires /etc/hosts setup: ${NODE_IP} pengovr.local)"
