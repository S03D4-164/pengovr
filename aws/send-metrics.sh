#!/bin/bash

# Cron用にPATHをセット
PATH=/usr/local/bin:/usr/bin:/bin:$PATH

QUEUE_NAME="scraping-tasks" # キュー名
METRIC_NAME="WaitingJobCount"
NAMESPACE="BullMQ/Metrics"
REGION="us-east-1"

# Redisから待機中のジョブ数を取得
WAITING_COUNT=$(redis-cli llen "bull:${QUEUE_NAME}:wait" 2>/dev/null)

if [ -z "$WAITING_COUNT" ]; then
  WAITING_COUNT=0
fi

aws cloudwatch put-metric-data \
  --namespace "$NAMESPACE" \
  --metric-data MetricName=$METRIC_NAME,Value=$WAITING_COUNT,Unit=Count,"Dimensions=[{Name=QueueName,Value=$QUEUE_NAME}]" \
  --region $REGION