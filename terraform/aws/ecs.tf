# ECS リソースの定義

# CloudWatch ロググループ
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/pengovr-worker-task"
  retention_in_days = 1

  tags = {
    Name = "Pengovr Worker Task Logs"
  }
}

# ECS クラスター
resource "aws_ecs_cluster" "main" {
  name = "pengovr-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = "Pengovr Cluster"
  }
}

# ECS クラスターキャパシティプロバイダー（Fargate）
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ECS タスク実行ロール
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "pengovr-ecs-task-execution-role"

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
    Name = "Pengovr ECS Task Execution Role"
  }
}

# ECS タスク実行ロールにポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# CloudWatch ロググループへのアクセス権限
resource "aws_iam_role_policy" "ecs_task_execution_cloudwatch" {
  name = "pengovr-ecs-task-execution-cloudwatch"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.worker.arn}:*"
      }
    ]
  })
}

# ECS タスク定義
resource "aws_ecs_task_definition" "worker" {
  family                   = "pengovr-worker-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.worker.repository_url}:latest"
      essential = true

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.storage.id
        },
        {
          name  = "REDIS_HOST"
          value = aws_instance.cache.private_ip
        },
        {
          name  = "QUEUE_NAME"
          value = "scraping-tasks"
        },
        {
          name  = "ENRICHMENT_QUEUE"
          value = "enrichment-tasks"
        },
        {
          name  = "S3_ACCESS_KEY"
          value = aws_iam_access_key.s3_user.id
        },
        {
          name  = "S3_SECRET_KEY"
          value = aws_iam_access_key.s3_user.secret
        }
      ]
    }
  ])

  tags = {
    Name = "Pengovr Worker Task Definition"
  }
}

# ECS Fargate サービス
resource "aws_ecs_service" "worker" {
  name            = "pengovr-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 0
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public.id]
    security_groups  = [aws_security_group.main.id]
    assign_public_ip = true
  }

  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [
    aws_ecs_task_definition.worker,
    aws_iam_role_policy.ecs_task_execution_cloudwatch
  ]

  tags = {
    Name = "Pengovr Worker Service"
  }
}

# オートスケーリング対象のリソース登録
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 20
  min_capacity       = 0
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# スケールアウト用 CloudWatch アラーム（キュー長 >= 1）
resource "aws_cloudwatch_metric_alarm" "queue_length_high" {
  alarm_name          = "pengovr-queue-length-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "WaitingJobCount"
  namespace           = "BullMQ/Metrics"
  period              = 30
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Trigger ECS scale out when queue has jobs"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = "scraping-tasks"
  }

  alarm_actions = [aws_appautoscaling_policy.ecs_policy_scale_out.arn]
}

# スケールイン用 CloudWatch アラーム（キュー長 < 1）
resource "aws_cloudwatch_metric_alarm" "queue_length_low" {
  alarm_name          = "pengovr-queue-length-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 5
  metric_name         = "WaitingJobCount"
  namespace           = "BullMQ/Metrics"
  period              = 30
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "Trigger ECS scale in when queue is empty"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = "scraping-tasks"
  }

  alarm_actions = [aws_appautoscaling_policy.ecs_policy_scale_in.arn]
}

# ステップスケーリングポリシー（スケールアウト）
resource "aws_appautoscaling_policy" "ecs_policy_scale_out" {
  name               = "pengovr-ecs-scale-out"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  step_scaling_policy_configuration {
    adjustment_type          = "ExactCapacity"
    cooldown                 = 60
    metric_aggregation_type  = "Average"

    step_adjustment {
      metric_interval_upper_bound = 5
      scaling_adjustment          = 1
    }

    step_adjustment {
      metric_interval_lower_bound = 5
      metric_interval_upper_bound = 10
      scaling_adjustment          = 5
    }

    step_adjustment {
      metric_interval_lower_bound = 10
      metric_interval_upper_bound = 20
      scaling_adjustment          = 10
    }

    step_adjustment {
      metric_interval_lower_bound = 20
      scaling_adjustment          = 20
    }
  }
}

# ステップスケーリングポリシー（スケールイン）
resource "aws_appautoscaling_policy" "ecs_policy_scale_in" {
  name               = "pengovr-ecs-scale-in"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  step_scaling_policy_configuration {
    adjustment_type          = "ExactCapacity"
    cooldown                 = 300
    metric_aggregation_type  = "Average"

    step_adjustment {
      metric_interval_upper_bound = 0
      scaling_adjustment          = 0
    }
  }
}

# 現在のリージョンデータソース
data "aws_region" "current" {}
