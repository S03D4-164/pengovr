#!/bin/bash

KEYNAME=pengovr-ec2-key
EC2=$1

if [ -z $1 ];then
  echo "usage: $0 <public ip>" && exit 1
fi

# valkeyのポートフォワード
ssh -4 -i "./${KEYNAME}.pem" -L 6379:127.0.0.1:6379 ec2-user@$1
