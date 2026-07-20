#!/bin/bash

# aws configure

# ECR={}.dkr.ecr.us-east-1.amazonaws.com
ECR=$1

# aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR}/pengovr-worker

# docker build --network=host -t pengovr-worker:latest -f ../wgeteer/Dockerfile.alpine --no-cache ../

docker tag pengovr-worker:latest ${ECR}/pengovr-worker:latest

docker push ${ECR}/pengovr-worker:latest

aws ecs update-service \
  --cluster pengovr-cluster \
  --service pengovr-worker-service \
  --force-new-deployment \
  --region us-east-1