import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface StorageConstructProps {
  bucketName?: string;
}

export class StorageConstruct extends Construct {
  public readonly storageBucket: s3.Bucket;
  public readonly s3User: iam.User;
  public readonly accessKey: iam.AccessKey;
  public readonly taskRole: iam.Role;

  constructor(scope: Construct, id: string, props?: StorageConstructProps) {
    super(scope, id);

    const bucketName = props?.bucketName || 'pengovr-storage';

    // S3 バケットの作成
    this.storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      accessControl: s3.BucketAccessControl.PRIVATE,
      lifecycleRules: [
        {
          id: 'delete-old-data',
          enabled: true,
          expiration: cdk.Duration.days(1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // S3 アクセス用ユーザー
    this.s3User = new iam.User(this, 'S3AccessUser', {
      userName: 'pengovr-s3-user',
    });
    this.storageBucket.grantReadWrite(this.s3User);

    // アクセスキーの作成
    this.accessKey = new iam.AccessKey(this, 'S3UserAccessKey', {
      user: this.s3User,
    });

    // ECS タスク用ロール
    this.taskRole = new iam.Role(this, 'WorkerTaskRole', {
      roleName: 'pengovr-worker-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
    );
  }
}
