terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "HOARE"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}

resource "aws_s3_bucket" "evidence" {
  bucket = var.evidence_bucket_name

  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudwatch_log_group" "hoare" {
  name              = "/hoare/staging"
  retention_in_days = 7
}

resource "aws_iam_role" "github_actions" {
  name = "hoare-staging-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRoleWithWebIdentity"
      Principal = {
        Federated = var.github_oidc_provider_arn
      }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:FARICJH59/tech-fusion-grid-ui:ref:refs/heads/feat/hoare-aws-reference-deployment"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_readonly_staging" {
  name = "hoare-staging-readonly-bootstrap"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sts:GetCallerIdentity",
        "cloudwatch:Describe*",
        "logs:DescribeLogGroups",
        "s3:GetBucketLocation",
        "s3:ListBucket"
      ]
      Resource = "*"
    }]
  })
}

output "evidence_bucket" {
  value = aws_s3_bucket.evidence.bucket
}

output "log_group" {
  value = aws_cloudwatch_log_group.hoare.name
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
