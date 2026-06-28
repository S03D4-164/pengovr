#!/bin/bash

set -e

echo "🚀 Deploying PengoVR Worker Composition to k3s (Public Network)..."

# 使用するコマンドの定義 (minikubeとの競合を避けるためフルパスまたはk3s経由)
KUBECTL="sudo k3s kubectl"
KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

# k3sの稼働確認
if ! $KUBECTL cluster-info >/dev/null 2>&1; then
    echo "❌ k3s is not running. Please start k3s first: sudo systemctl start k3s"
    exit 1
fi

echo "✅ k3s cluster is running"

# Helmの確認
if ! command -v helm >/dev/null 2>&1; then
    echo "❌ Helm is not installed. Please install Helm first:"
    echo "   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    exit 1
fi

echo "✅ Helm is installed"

# イメージの確認とインポート
echo "🔍 Checking and Importing local images..."
REQUIRED_IMAGES=("pengovr-worker:latest" "pengovr-enricher:latest" "gosb:latest")

# 最後にインポートしたイメージIDを記録するディレクトリ
CACHE_DIR="$HOME/.pengovr_cache"
mkdir -p "$CACHE_DIR"

for image in "${REQUIRED_IMAGES[@]}"; do
    # 1. ホストDocker側のイメージIDを取得
    DOCKER_ID=$(docker inspect --format='{{.Id}}' "$image" 2>/dev/null || echo "")
    
    if [ -z "$DOCKER_ID" ]; then
        echo "❌ Required image not found in Docker: $image"
        echo "Please build images first:"
        if [ "$image" == "pengovr-worker:latest" ]; then
            echo "  docker build --network=host -t pengovr-worker:latest -f ../../wgeteer/Dockerfile.alpine ../../"
        elif [ "$image" == "pengovr-enricher:latest" ]; then
            echo "  docker build -t pengovr-enricher:latest -f ../../enricher/Dockerfile.alpine ../../"
        elif [ "$image" == "gosb:latest" ]; then
            echo "  docker build -t gosb:latest ../../gosb/"
        fi
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
        if [ "$image" == "pengovr-worker:latest" ]; then UPDATE_WORKER=true; fi
        if [ "$image" == "pengovr-enricher:latest" ]; then UPDATE_ENRICHER=true; fi
        if [ "$image" == "gosb:latest" ]; then UPDATE_GOSB=true; fi
    fi
done

# Namespace作成 (念のため)
echo "📦 Ensuring namespace..."
$KUBECTL apply -f ../namespace.yaml

# KEDAの確認とインストール
echo "🔍 Checking KEDA installation..."
if ! $KUBECTL get crd scaledobjects.keda.sh >/dev/null 2>&1; then
    echo "📥 KEDA not found. Installing KEDA via Helm..."
    helm repo add kedacore https://kedacore.github.io/charts >/dev/null 2>&1
    helm repo update >/dev/null 2>&1
    helm install keda kedacore/keda --namespace keda --create-namespace
    echo "⏳ Waiting for KEDA operator to be ready..."
    $KUBECTL wait --for=condition=available --timeout=300s deployment/keda-operator -n keda || echo "⚠️  KEDA wait timed out, proceeding anyway..."
else
    echo "✅ KEDA is already installed"
fi

# 各リソースのデプロイ
$KUBECTL apply -f secret.yaml
echo "⚙️  Applying manifests..."
$KUBECTL apply -f configmap.yaml
$KUBECTL apply -f redis.yaml
$KUBECTL apply -f seaweedfs.yaml

echo "⏳ Waiting for Redis and SeaweedFS..."
$KUBECTL wait --for=condition=ready pod -l app=redis --timeout=120s -n pengovr
$KUBECTL wait --for=condition=ready pod -l app=seaweedfs --timeout=120s -n pengovr

$KUBECTL apply -f gosb-deployment.yaml
$KUBECTL apply -f enricher-deployment.yaml
$KUBECTL apply -f worker-deployment.yaml
$KUBECTL apply -f keda-scaler.yaml
$KUBECTL apply -f daemonset.yaml

# 強制再起動 (イメージが更新された場合のみ)
if [ "$UPDATE_WORKER" == "true" ]; then
    echo "♻️  Restarting Worker to reflect changes..."
    $KUBECTL rollout restart deployment/worker -n pengovr
fi

if [ "$UPDATE_ENRICHER" == "true" ]; then
    echo "♻️  Restarting Enricher to reflect changes..."
    $KUBECTL rollout restart deployment/enricher -n pengovr
fi

if [ "$UPDATE_GOSB" == "true" ]; then
    echo "♻️  Restarting GOSB to reflect changes..."
    $KUBECTL rollout restart deployment/gosb -n pengovr
fi

echo "✅ Worker deployment complete!"
echo "🔍 Check status: $KUBECTL get pods -n pengovr -l 'app in (worker, enricher, gosb)'"
echo "💡 IMPORTANT: Note the external IP of this worker node. You will need it for the local API deployment."
