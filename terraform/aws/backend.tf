terraform {
  backend "s3" {
    bucket  = "pengovr-storage-dev"
    key     = "terraform/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
