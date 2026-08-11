import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface NetworkConstructProps {
  myIp?: string;
}

export class NetworkConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly keyPair: ec2.KeyPair;

  constructor(scope: Construct, id: string, props?: NetworkConstructProps) {
    super(scope, id);

    // VPC の作成
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // セキュリティグループの作成
    this.securityGroup = new ec2.SecurityGroup(this, 'MyEc2SecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for CDK EC2 instance',
      allowAllOutbound: true,
    });

    // SSH ルールの追加（MY_IP環境変数がある場合）
    const myIp = props?.myIp || process.env.MY_IP;
    if (myIp) {
      this.securityGroup.addIngressRule(
        ec2.Peer.ipv4(`${myIp}/32`),
        ec2.Port.tcp(22),
        'Allow SSH access from My IP',
      );
    }

    // Redis/Valkey ポート（VPC内からのアクセス）
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis/Valkey access from VPC',
    );

    // キーペアの作成
    this.keyPair = new ec2.KeyPair(this, 'MyKeyPair', {
      keyPairName: 'pengovr-ec2-ssh',
      type: ec2.KeyPairType.ED25519,
    });
  }
}
