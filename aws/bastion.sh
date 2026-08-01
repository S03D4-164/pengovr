#!/bin/bash

KEYNAME=pengovr-ec2-ssh
EC2=$1

if [ -z $1 ];then
  echo "usage: $0 <public ip>" && exit 1
fi

aws ssm get-parameter \
  --name "/ec2/keypair/$(aws ec2 describe-key-pairs --key-names ${KEYNAME} --query 'KeyPairs[0].KeyPairId' --output text)" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text > ${KEYNAME}.pem

# パーミッションの変更
mv ${KEYNAME}.pem ~/.ssh && chmod 400 ~/.ssh/${KEYNAME}.pem 

# valkeyのポートフォワード
ssh -4 -i "~/.ssh/${KEYNAME}.pem" -L 6379:127.0.0.1:6379 ec2-user@$1
