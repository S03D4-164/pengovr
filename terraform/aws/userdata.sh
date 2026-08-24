#!/bin/bash
set -e

# Valkey のインストールと設定
dnf update -y
dnf install -y valkey cronie

# Valkey のバインドアドレスとプロテクションモードを設定
sed -i 's/^bind .*/bind 0.0.0.0/' /etc/valkey/valkey.conf
sed -i 's/^protected-mode yes/protected-mode no/' /etc/valkey/valkey.conf

# Valkey の起動
systemctl enable valkey
systemctl start valkey

# BullMQ メトリクス送信スクリプトの作成
cat << 'EOF' > /usr/local/bin/send_bullmq_metrics.sh
#!/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH
QUEUE_NAME="scraping-tasks"
METRIC_NAME="WaitingJobCount"
NAMESPACE="BullMQ/Metrics"
REGION="${region}"

WAITING=$(valkey-cli llen "bull:$QUEUE_NAME:wait" 2>/dev/null || echo 0)
ACTIVE=$(valkey-cli llen "bull:$QUEUE_NAME:active" 2>/dev/null || echo 0)

TOTAL_COUNT=$((WAITING + ACTIVE))

aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-data MetricName=$METRIC_NAME,Value=$TOTAL_COUNT,Unit=Count,"Dimensions=[{Name=QueueName,Value=$QUEUE_NAME}]" \
  --region $REGION
EOF

chmod +x /usr/local/bin/send_bullmq_metrics.sh

# Cron ジョブの設定（1 分ごとにメトリクスを送信）
echo "* * * * * /usr/local/bin/send_bullmq_metrics.sh" | crontab -

# Cron デーモンの起動
systemctl start crond.service
