# Worker サービス用 ECR リポジトリ
# CDK の DockerImageAsset と同様に、wgeteer の Docker イメージをビルド・プッシュする
resource "aws_ecr_repository" "worker" {
  name                 = "pengovr-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "Pengovr Worker Repository"
  }
}

# ECR ライフサイクルポリシー（古いイメージを削除）
resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 1 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
