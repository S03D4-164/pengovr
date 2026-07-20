#!/bin/bash

ssh -4 -i "~/.ssh/pengovr-bastion-ssh.pem" -L 6379:127.0.0.1:6379 ubuntu@$1
