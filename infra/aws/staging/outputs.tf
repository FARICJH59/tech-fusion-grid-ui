output "evidence_bucket" {
  description = "Staging evidence bucket name."
  value       = aws_s3_bucket.evidence.bucket
}

output "log_group" {
  description = "Staging CloudWatch log group."
  value       = aws_cloudwatch_log_group.hoare.name
}

output "github_actions_role_arn" {
  description = "IAM role for GitHub Actions OIDC in staging."
  value       = aws_iam_role.github_actions.arn
}
