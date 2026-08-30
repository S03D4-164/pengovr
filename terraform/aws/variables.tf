variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "環境名 (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "bucket_name" {
  description = "S3 バケット名（グローバルで一意である必要があります）"
  type        = string
  default     = "pengovr-storage-dev"
}

variable "object_expiration_days" {
  description = "S3 オブジェクト自動削除までの日数"
  type        = number
  default     = 1
}

variable "my_ip" {
  description = "SSH アクセスを許可する IP アドレス"
  type        = string
  default     = ""
}
