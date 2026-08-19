variable "aws_region" {
  description = "AWS region for disposable HOARE staging resources."
  type        = string
  default     = "us-east-1"
}

variable "evidence_bucket_name" {
  description = "Globally unique disposable S3 bucket name for staging evidence."
  type        = string
}

variable "github_oidc_provider_arn" {
  description = "Existing GitHub Actions OIDC provider ARN in the target AWS account."
  type        = string
}
