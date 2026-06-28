#!/bin/bash

set -e

echo "🚀 Starting port forwarding for PengoVR services on k3s..."

# 使用するコマンドの定義 (minikubeとの競合を避けるためフルパスまたはk3s経由)
KUBECTL="sudo k3s kubectl"
KUBECONFIG="/etc/rancher/k3s/k3s.yaml"

# k3sの稼働確認
if ! $KUBECTL cluster-info >/dev/null 2>&1; then
    echo "❌ k3s is not running. Please start k3s first:"
    echo "   sudo systemctl start k3s"
    exit 1
fi

# Function to stop port forwarding on exit
cleanup() {
    echo ""
    echo "🛑 Stopping port forwarding..."
    # 関連するバックグラウンドプロセスを終了
    if [ ! -z "$API_PID" ]; then kill $API_PID 2>/dev/null || true; fi
    if [ ! -z "$UI_PID" ]; then kill $UI_PID 2>/dev/null || true; fi
    exit 0
}

# Set up trap to clean up background jobs on exit
trap cleanup SIGINT SIGTERM

# Start port forwarding for API
echo "🔌 Forwarding API port (3000)..."
$KUBECTL port-forward -n pengovr svc/api 3000:3000 > /dev/null 2>&1 &
API_PID=$!

# Start port forwarding for UI
echo "🖥️  Forwarding UI port (3001)..."
$KUBECTL port-forward -n pengovr svc/ui 3001:3001 > /dev/null 2>&1 &
UI_PID=$!

# Wait a moment for port forwarding to start
sleep 5

# Check if port forwarding is working
if kill -0 $API_PID 2>/dev/null && kill -0 $UI_PID 2>/dev/null; then
    echo "✅ Port forwarding started successfully!"
    echo ""
    echo "🌐 Access services:"
    echo "  UI:  http://localhost:3001"
    echo "  API: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop port forwarding"
    
    # Wait for background jobs
    wait $API_PID $UI_PID
else
    echo "❌ Failed to start port forwarding. Are the pods running?"
    echo "   Check status with: $KUBECTL get pods -n pengovr"
    cleanup
fi
