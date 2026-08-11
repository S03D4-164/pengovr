import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as path from 'path';

export interface ContainerConstructProps {
  vpc: ec2.Vpc;
  taskRole: iam.Role;
  redisHost: string;
  s3BucketName: string;
  s3AccessKeyId: string;
  s3SecretKey: string;
}

export class ContainerConstruct extends Construct {
  public readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ContainerConstructProps) {
    super(scope, id);

    // Docker イメージのアセット（ECR に自動ビルド・プッシュ）
    const workerImageAsset = new ecr_assets.DockerImageAsset(
      this,
      'WorkerImageAsset',
      {
        directory: path.join(__dirname, '../../../wgeteer'),
        file: 'Dockerfile.alpine',
      },
    );

    new cdk.CfnOutput(this, 'BuiltContainerImageUri', {
      value: workerImageAsset.imageUri,
      description:
        'URI of the Docker image automatically built and pushed by CDK',
    });

    // CloudWatch ロググループ
    const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: '/ecs/pengovr-worker-task',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_DAY,
    });

    // ECS クラスター
    const cluster = new ecs.Cluster(this, 'PengovrCluster', {
      clusterName: 'pengovr-cluster',
      vpc: props.vpc,
    });

    // Fargate タスク定義
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'WorkerTaskDef',
      {
        family: 'pengovr-worker-task',
        cpu: 512,
        memoryLimitMiB: 1024,
        taskRole: props.taskRole,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      },
    );

    // コンテナの追加
    taskDefinition.addContainer('WorkerContainer', {
      containerName: 'worker',
      image: ecs.ContainerImage.fromDockerImageAsset(workerImageAsset),
      essential: true,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        S3_BUCKET: props.s3BucketName,
        REDIS_HOST: props.redisHost,
        QUEUE_NAME: 'scraping-tasks',
        ENRICHMENT_QUEUE: 'enrichment-tasks',
        S3_ACCESS_KEY: props.s3AccessKeyId,
        S3_SECRET_KEY: props.s3SecretKey,
      },
    });

    // Fargate サービス
    this.fargateService = new ecs.FargateService(this, 'WorkerService', {
      serviceName: 'pengovr-worker-service',
      cluster,
      taskDefinition,
      desiredCount: 0,
      assignPublicIp: true,
      circuitBreaker: {
        rollback: true,
      },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // CloudWatch カスタムメトリクス
    const queueLengthMetric = new cloudwatch.Metric({
      namespace: 'BullMQ/Metrics',
      metricName: 'WaitingJobCount',
      dimensionsMap: {
        QueueName: 'scraping-tasks',
      },
      statistic: 'Average',
      period: cdk.Duration.seconds(30),
    });
    
    const max = 10;
    // オートスケーリング設定
    const scalableTarget = this.fargateService.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: max,
    });

    // スケールアウトポリシー
    scalableTarget.scaleOnMetric('StepScaleOutPolicy', {
      metric: queueLengthMetric,
      scalingSteps: [
        { upper: 0, change: 0 },
        { lower: 1, upper: 5, change: 1 },
        { lower: 5, upper: 10, change: 5 },
        { lower: 10, change: max },
      ],
      adjustmentType: applicationautoscaling.AdjustmentType.EXACT_CAPACITY,
      evaluationPeriods: 1,
      metricAggregationType:
        applicationautoscaling.MetricAggregationType.AVERAGE,
      cooldown: cdk.Duration.seconds(60),
    });

    // スケールインポリシー
    scalableTarget.scaleOnMetric('StepScaleInPolicy', {
      metric: queueLengthMetric,
      scalingSteps: [
        { upper: 0, change: 0 },
        { lower: 1, change: 0 },
      ],
      adjustmentType: applicationautoscaling.AdjustmentType.EXACT_CAPACITY,
      evaluationPeriods: 3,
      metricAggregationType:
        applicationautoscaling.MetricAggregationType.AVERAGE,
      cooldown: cdk.Duration.seconds(300),
    });

    // CloudWatch メトリクス送信権限
    props.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      }),
    );
  }
}
