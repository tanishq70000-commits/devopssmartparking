resource "aws_s3_bucket" "media" {
  bucket = "smart-parking-media-${var.aws_region}"

  tags = { Name = "smart-parking-media" }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "backups" {
  bucket = "smart-parking-backups-${var.aws_region}"
  tags   = { Name = "smart-parking-backups" }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"
    expiration {
      days = 30
    }
  }
}

resource "aws_iam_user" "app_user" {
  name = "smart-parking-app"
  tags = { Name = "smart-parking-app" }
}

resource "aws_iam_access_key" "app_key" {
  user = aws_iam_user.app_user.name
}

resource "aws_iam_policy" "s3_policy" {
  name = "smart-parking-s3-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "app_s3" {
  user       = aws_iam_user.app_user.name
  policy_arn = aws_iam_policy.s3_policy.arn
}