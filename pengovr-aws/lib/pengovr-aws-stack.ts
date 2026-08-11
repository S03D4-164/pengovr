import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { StorageConstruct } from './constructs/storage-construct';
import { NetworkConstruct } from './constructs/network-construct';
import { CacheConstruct } from './constructs/cache-construct';
import { ContainerConstruct } from './constructs/container-construct';

export class PengovrAwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =============== 1. Storage レイヤー ===============
    const storageConstruct = new StorageConstruct(this, 'Storage');

    // Storage Outputs
    new cdk.CfnOutput(this, 'S3AccessKeyId', {
      value: storageConstruct.accessKey.accessKeyId,
      description: 'S3 Access Key ID',
    });

    new cdk.CfnOutput(this, 'S3SecretAccessKeySecretName', {
      value: storageConstruct.accessKey.secretAccessKey.unsafeUnwrap(),
      description: 'S3 Secret Access Key',
    });

    // =============== 2. Network レイヤー ===============
    const networkConstruct = new NetworkConstruct(this, 'Network', {
      myIp: process.env.MY_IP,
    });

    // =============== 3. Cache レイヤー ===============
    const cacheConstruct = new CacheConstruct(this, 'Cache', {
      vpc: networkConstruct.vpc,
      securityGroup: networkConstruct.securityGroup,
      keyPair: networkConstruct.keyPair,
    });

    // Cache Outputs
    new cdk.CfnOutput(this, 'Ec2PublicIp', {
      value: cacheConstruct.instance.instancePublicIp,
      description: 'Public IP address of the EC2 instance',
    });

    // =============== 4. Container レイヤー ===============
    const containerConstruct = new ContainerConstruct(this, 'Container', {
      vpc: networkConstruct.vpc,
      taskRole: storageConstruct.taskRole,
      redisHost: cacheConstruct.instancePrivateIp,
      s3BucketName: storageConstruct.storageBucket.bucketName,
      s3AccessKeyId: storageConstruct.accessKey.accessKeyId,
      s3SecretKey: storageConstruct.accessKey.secretAccessKey.unsafeUnwrap(),
    });

    // Container Outputs
    new cdk.CfnOutput(this, 'BuiltContainerImageUri', {
      value: 'See CloudFormation outputs for container image URI',
      description: 'Docker image URI in ECR',
    });
  }
}
