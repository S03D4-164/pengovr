# S3 バケット名
output "bucket_name" {
  description = "S3 バケット名"
  value       = aws_s3_bucket.storage.id
}

# S3 バケット ARN
output "bucket_arn" {
  description = "S3 バケットの ARN"
  value       = aws_s3_bucket.storage.arn
}

# IAM ユーザー名
output "s3_user_name" {
  description = "S3 アクセス用 IAM ユーザー名"
  value       = aws_iam_user.s3_user.name
}

# アクセスキー ID
output "s3_access_key_id" {
  description = "S3 ユーザーのアクセスキー ID"
  value       = aws_iam_access_key.s3_user.id
  sensitive   = true
}

# シークレットアクセスキー
output "s3_secret_access_key" {
  description = "S3 ユーザーのシークレットアクセスキー"
  value       = aws_iam_access_key.s3_user.secret
  sensitive   = true
}

# ECS タスクロール ARN
output "ecs_task_role_arn" {
  description = "ECS タスクロールの ARN"
  value       = aws_iam_role.ecs_task_role.arn
}

# ECS タスクロール名
output "ecs_task_role_name" {
  description = "ECS タスクロール名"
  value       = aws_iam_role.ecs_task_role.name
}

# VPC ID
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

# パブリックサブネット ID
output "public_subnet_id" {
  description = "パブリックサブネット ID"
  value       = aws_subnet.public.id
}

# セキュリティグループ ID
output "security_group_id" {
  description = "セキュリティグループ ID"
  value       = aws_security_group.main.id
}

# キャッシュインスタンスのプライベート IP
output "cache_instance_private_ip" {
  description = "Redis/Valkey インスタンスのプライベート IP"
  value       = aws_instance.cache.private_ip
}

# キャッシュインスタンスのパブリック IP
output "cache_instance_public_ip" {
  description = "Redis/Valkey インスタンスのパブリック IP"
  value       = aws_instance.cache.public_ip
}

# EC2 秘密鍵のパス
output "ec2_private_key_path" {
  description = "EC2 インスタンス接続用の秘密鍵のパス"
  value       = local_sensitive_file.private_key.filename
  sensitive   = false
}

# ECR リポジトリ URI
output "ecr_repository_uri" {
  description = "Worker 用 ECR リポジトリ URI"
  value       = aws_ecr_repository.worker.repository_url
}

# ECR リポジトリ名
output "ecr_repository_name" {
  description = "Worker 用 ECR リポジトリ名"
  value       = aws_ecr_repository.worker.name
}

# ECS クラスター名
output "ecs_cluster_name" {
  description = "ECS クラスター名"
  value       = aws_ecs_cluster.main.name
}

# ECS サービス名
output "ecs_service_name" {
  description = "ECS サービス名"
  value       = aws_ecs_service.worker.name
}

# ECS タスク定義 ARN
output "ecs_task_definition_arn" {
  description = "ECS タスク定義の ARN"
  value       = aws_ecs_task_definition.worker.arn
}

# ECS タスク定義ファミリー
output "ecs_task_definition_family" {
  description = "ECS タスク定義ファミリー名"
  value       = aws_ecs_task_definition.worker.family
}
