variable "aws_region" {
  description = "AWS region for disposable HOARE staging resources."
  type        = string
  default     = "us-east-2"
}

variable "evidence_bucket_name" {
  description = "Globally unique disposable S3 bucket name for staging evidence."
  type        = string
}
