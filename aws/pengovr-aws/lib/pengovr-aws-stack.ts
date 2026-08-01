import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PengovrAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const storageBucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: 'pengovr-storage',
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED, // または OBJECT_WRITER
      accessControl: s3.BucketAccessControl.PRIVATE,
      lifecycleRules: [
        {
          id: 'delete-old-data', // ルール識別ID
          enabled: true, // ルール有効化
          expiration: cdk.Duration.days(1), // オブジェクト作成から1日後に削除
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1), // 1日経った未完了アップロードを破棄
        },
      ],
      // cdk destroy 実行時に、バケット内にオブジェクトがあっても自動削除してバケットを削除する
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // セキュリティ設定（パブリックアクセスの完全ブロック）
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    const s3User = new iam.User(this, 'S3AccessUser', {
      userName: 'pengovr-s3-user',
    });
    storageBucket.grantReadWrite(s3User);
    // アクセスキーを作成（アクセスキーID & シークレットキーが生成される）
    const accessKey = new iam.AccessKey(this, 'S3UserAccessKey', {
      user: s3User,
    });
    // アクセスキーID を Output に表示
    new cdk.CfnOutput(this, 'S3AccessKeyId', {
      value: accessKey.accessKeyId,
      description: 'S3 Access Key ID',
    });
    // シークレットキーを AWS Secrets Manager に安全に保管（推奨）
    new cdk.CfnOutput(this, 'S3SecretAccessKeySecretName', {
      value: accessKey.secretAccessKey.unsafeUnwrap(), // ※ターミナルに出力したい場合
      description: 'S3 Secret Access Key',
    });

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'), // ネットワークのCIDR範囲
      maxAzs: 1, // 1つのアベイラビリティゾーンを使用
      natGateways: 0, // テスト環境用：コスト節約のためNATゲートウェイを0（なし）にする
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'MyEc2SecurityGroup', {
      vpc: vpc,
      description: 'Security group for CDK EC2 instance',
      allowAllOutbound: true, // アウトバウンド（送信）通信はすべて許可
    });

    // MY_IP=$(curl -s https://checkip.amazonaws.com) cdk deployのようにデプロイする必要がある
    const myIp = process.env.MY_IP;
    if (myIp) {
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(`${myIp}/32`),
        ec2.Port.tcp(22),
        'Allow SSH access from My IP',
      );
    }

    const keyPair = new ec2.KeyPair(this, 'MyKeyPair', {
      keyPairName: 'pengovr-ec2-ssh',
      type: ec2.KeyPairType.ED25519, // または RSA
    });

    const instance = new ec2.Instance(this, 'MyEc2Instance', {
      vpc: vpc,
      securityGroup: securityGroup,
      keyPair: keyPair,

      // 無料枠で試せる最小クラス (t2.micro または t3.micro)
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      // 最新の Amazon Linux 2023 AMI を自動取得
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),

      // SSHキーペア不要でWebブラウザから安全にログイン可能にする（SSM Manager）
      ssmSessionPermissions: true,

      // 配置先サブネット
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    instance.addUserData(
      'dnf update -y',
      'dnf install -y valkey', // Amazon Linux 2023 推奨の Redis 互換パッケージ
      'systemctl enable valkey', // OS起動時の自動起動を有効化
      'systemctl start valkey', // 今すぐ起動
    );

    // 出力設定：EC2のパブリックIPアドレスを表示
    new cdk.CfnOutput(this, 'Ec2PublicIp', {
      value: instance.instancePublicIp,
      description: 'Public IP address of the EC2 instance',
    });
  }
}
