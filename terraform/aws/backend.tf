terraform {
  backend "s3" {
    bucket  = "pengovr-terraform-state-dev"
    key     = "terraform/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
