ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REPO_NAME=cdk-hnb659fds-container-assets-${ACCOUNT_ID}-${REGION}

aws ecr delete-repository \
  --repository-name ${REPO_NAME} \
  --force \
  --region ${REGION}