output "instance_public_ip" {
  value       = aws_instance.devops_server.public_ip
  description = "EC2 Public IP — SSH and app access"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS PostgreSQL endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "ElastiCache Redis endpoint"
}

output "s3_media_bucket" {
  value       = aws_s3_bucket.media.bucket
  description = "S3 Media bucket name"
}

output "app_iam_access_key" {
  value       = aws_iam_access_key.app_key.id
  description = "IAM access key ID for app S3 access"
  sensitive   = true
}

output "app_iam_secret_key" {
  value       = aws_iam_access_key.app_key.secret
  description = "IAM secret key for app S3 access"
  sensitive   = true
}