#!/bin/bash

# aws configure

# ECR={}.dkr.ecr.us-east-1.amazonaws.com
ECR=$1
REPO=pengovr-backend

# docker build --network=host -t ${REPO}:latest -f ../wgeteer/Dockerfile.alpine --no-cache ../

# aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR}/${REPO}

docker tag ${REPO}:latest ${ECR}/${REPO}:latest

docker push ${ECR}/${REPO}:latest

aws ecs update-service \
  --cluster pengovr-cluster \
  --service pengovr-worker-service \
  --force-new-deployment \
  --region us-east-1