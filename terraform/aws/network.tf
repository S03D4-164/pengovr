# VPC の作成
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "pengovr-vpc"
  }
}

# パブリックサブネット
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "pengovr-public-subnet"
  }
}

# インターネットゲートウェイ
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "pengovr-igw"
  }
}

# ルートテーブル
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = {
    Name = "pengovr-public-rt"
  }
}

# ルートテーブルの関連付け
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# セキュリティグループ
resource "aws_security_group" "main" {
  name        = "pengovr-ec2-sg"
  description = "Security group for Pengovr EC2 instances"
  vpc_id      = aws_vpc.main.id

  # すべてのアウトバウンドトラフィックを許可
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "pengovr-security-group"
  }
}

# SSH ルール（MY_IP がある場合）
resource "aws_security_group_rule" "ssh" {
  count = var.my_ip != "" ? 1 : 0

  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["${var.my_ip}/32"]
  security_group_id = aws_security_group.main.id

  description = "Allow SSH access from My IP"
}

# Redis/Valkey ポート（VPC 内からのアクセス）
resource "aws_security_group_rule" "redis" {
  type              = "ingress"
  from_port         = 6379
  to_port           = 6379
  protocol          = "tcp"
  cidr_blocks       = ["10.0.0.0/16"]
  security_group_id = aws_security_group.main.id

  description = "Allow Redis/Valkey access from VPC"
}

# EC2 キーペアの生成
resource "tls_private_key" "main" {
  algorithm = "ED25519"
}

# AWS EC2 キーペア（生成した公開鍵を使用）
resource "aws_key_pair" "main" {
  key_name   = "pengovr-ec2-ssh"
  public_key = tls_private_key.main.public_key_openssh

  tags = {
    Name = "pengovr-ec2-key"
  }
}

# 秘密鍵をローカルファイルに保存（sensitive）
resource "local_sensitive_file" "private_key" {
  filename        = "${path.module}/pengovr-ec2-key.pem"
  content         = tls_private_key.main.private_key_openssh
  file_permission = "0600"

  depends_on = [tls_private_key.main]
}

# 利用可能なアベイラビリティゾーンの取得
data "aws_availability_zones" "available" {
  state = "available"
}

# 最新の Amazon Linux 2023 AMI の取得（x86_64 アーキテクチャ）
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}
