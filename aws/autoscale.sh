#!/bin/bash

CLUSTER_NAME="pengovr-cluster"
SERVICE_NAME="pengovr-worker-service"
REGION="us-east-1"

# --- ステップ1: スケーラブルターゲットの登録（最小0台、最大5台） ---
echo "1. Registering scalable target..."
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/${CLUSTER_NAME}/${SERVICE_NAME} \
  --min-capacity 0 \
  --max-capacity 5 \
  --region ${REGION}

# --- ステップ2: カスタムメトリクスに基づくターゲット追跡ポリシーの設定 ---
echo "2. Putting scaling policy..."
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/${CLUSTER_NAME}/${SERVICE_NAME} \
  --policy-name BullMQ-TargetTracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 1.0,
    "CustomizedMetricSpecification": {
      "MetricName": "WaitingJobCount",
      "Namespace": "BullMQ/Metrics",
      "Dimensions": [
        {
          "Name": "QueueName",
          "Value": "scraping-tasks"
        }
      ],
      "Statistic": "Average"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }' \
  --region ${REGION}

echo "Done!"