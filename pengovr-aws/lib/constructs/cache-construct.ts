import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface CacheConstructProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  keyPair: ec2.KeyPair;
}

export class CacheConstruct extends Construct {
  public readonly instance: ec2.Instance;
  public readonly instancePrivateIp: string;

  constructor(scope: Construct, id: string, props: CacheConstructProps) {
    super(scope, id);

    // EC2 インスタンスの作成（Redis/Valkey）
    this.instance = new ec2.Instance(this, 'MyEc2Instance', {
      vpc: props.vpc,
      securityGroup: props.securityGroup,
      keyPair: props.keyPair,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      ssmSessionPermissions: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // CloudWatch メトリクス送信権限
    this.instance.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      }),
    );

    // Valkey セットアップと起動スクリプト
    this.instance.addUserData(
      'dnf update -y',
      'dnf install -y valkey cronie',
      "sed -i 's/^bind .*/bind 0.0.0.0/' /etc/valkey/valkey.conf",
      "sed -i 's/^protected-mode yes/protected-mode no/' /etc/valkey/valkey.conf",
      'systemctl enable valkey',
      'systemctl start valkey',
      `cat << 'EOF' > /usr/local/bin/send_bullmq_metrics.sh
#!/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH
QUEUE_NAME="scraping-tasks"
METRIC_NAME="WaitingJobCount"
NAMESPACE="BullMQ/Metrics"
REGION="us-east-1"

WAITING=$(valkey-cli llen "bull:$QUEUE_NAME:wait" 2>/dev/null || echo 0)
ACTIVE=$(valkey-cli llen "bull:$QUEUE_NAME:active" 2>/dev/null || echo 0)

TOTAL_COUNT=$((WAITING + ACTIVE))

aws cloudwatch put-metric-data \\
  --namespace "$NAMESPACE" \\
  --metric-data MetricName=$METRIC_NAME,Value=$TOTAL_COUNT,Unit=Count,"Dimensions=[{Name=QueueName,Value=$QUEUE_NAME}]" \\
  --region $REGION
EOF`,
      'chmod +x /usr/local/bin/send_bullmq_metrics.sh',
      'echo "* * * * * /usr/local/bin/send_bullmq_metrics.sh" | crontab -',
      'systemctl start crond.service',
    );

    // プライベート IP を保存（他のコンポーネントから参照可能に）
    this.instancePrivateIp = this.instance.instancePrivateIp;
  }
}
