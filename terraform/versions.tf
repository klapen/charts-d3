terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront + its ACM certificate must live in us-east-1. That is also the
# account's default region, so a single provider block covers everything here.
provider "aws" {
  region = "us-east-1"
}
