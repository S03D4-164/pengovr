# EC2 インスタンスの IAM ロール
resource "aws_iam_role" "ec2_cache_role" {
  name = "pengovr-cache-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "Pengovr Cache Instance Role"
  }
}

# CloudWatch メトリクス送信権限
resource "aws_iam_role_policy" "ec2_cloudwatch" {
  name = "pengovr-ec2-cloudwatch-policy"
  role = aws_iam_role.ec2_cache_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# EC2 インスタンスプロファイル
resource "aws_iam_instance_profile" "ec2_cache" {
  name = "pengovr-cache-instance-profile"
  role = aws_iam_role.ec2_cache_role.name
}

# Redis/Valkey 用ユーザーデータスクリプト
locals {
  userdata = templatefile("${path.module}/userdata.sh", {
    region = var.aws_region
  })
}

# EC2 インスタンス（Redis/Valkey）
resource "aws_instance" "cache" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.main.id]
  key_name               = aws_key_pair.main.key_name
  iam_instance_profile   = aws_iam_instance_profile.ec2_cache.name

  # ユーザーデータスクリプト
  user_data              = base64encode(local.userdata)
  monitoring             = true

  tags = {
    Name = "pengovr-cache-instance"
  }

  depends_on = [aws_internet_gateway.main]
}
