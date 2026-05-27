resource "aws_elasticache_subnet_group" "main" {
  name       = "smart-parking-redis-subnet"
  subnet_ids = [aws_subnet.public.id]
}

resource "aws_security_group" "redis_sg" {
  name        = "smart-parking-redis-sg"
  description = "Allow Redis from EC2"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "smart-parking-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis_sg.id]

  snapshot_retention_limit = 5
  snapshot_window          = "03:00-04:00"

  tags = { Name = "smart-parking-redis" }
}