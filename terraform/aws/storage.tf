# S3 バケットの作成
resource "aws_s3_bucket" "storage" {
  bucket              = var.bucket_name
  force_destroy       = true
  object_lock_enabled = false

  tags = {
    Name = "Pengovr Storage Bucket"
  }
}

# バケットのオブジェクト所有権設定
resource "aws_s3_bucket_ownership_controls" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }

  depends_on = [aws_s3_bucket_public_access_block.storage]
}

# パブリックアクセスブロック設定
resource "aws_s3_bucket_public_access_block" "storage" {
  bucket = aws_s3_bucket.storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# バケット暗号化設定 (S3 マネージド暗号化)
resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }

  depends_on = [aws_s3_bucket_public_access_block.storage]
}

# ライフサイクルルール
resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    id     = "delete-old-data"
    status = "Enabled"
    filter {}
    # 1 日後にオブジェクトを削除
    expiration {
      days = var.object_expiration_days
    }

    # 1 日後にマルチパートアップロードを中止
    abort_incomplete_multipart_upload {
      days_after_initiation = var.object_expiration_days
    }
  }

  depends_on = [aws_s3_bucket_public_access_block.storage]
}

# S3 アクセス用 IAM ユーザー
resource "aws_iam_user" "s3_user" {
  name = "pengovr-s3-user"

  tags = {
    Name = "Pengovr S3 Access User"
  }
}

# S3 バケットアクセスポリシー
resource "aws_iam_user_policy" "s3_access" {
  name = "pengovr-s3-access-policy"
  user = aws_iam_user.s3_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.storage.arn,
          "${aws_s3_bucket.storage.arn}/*"
        ]
      }
    ]
  })
}

# アクセスキーの作成
resource "aws_iam_access_key" "s3_user" {
  user = aws_iam_user.s3_user.name

  # アクセスキーが多数ある場合は古いものを削除
  lifecycle {
    create_before_destroy = true
  }
}

# ECS タスク用ロール
resource "aws_iam_role" "ecs_task_role" {
  name = "pengovr-worker-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "Pengovr ECS Task Role"
  }
}

# ECS タスクロールに S3 フルアクセスポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "ecs_s3_access" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}
