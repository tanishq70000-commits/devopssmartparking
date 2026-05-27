resource "aws_db_subnet_group" "main" {
  name       = "smart-parking-db-subnet-group"
  subnet_ids = [aws_subnet.public.id]

  tags = {
    Name = "smart-parking-db-subnet-group"
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "smart-parking-rds-sg"
  description = "Allow Postgres access from EC2"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "smart-parking-rds-sg" }
}

resource "aws_db_instance" "postgres" {
  identifier             = "smart-parking-postgres"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp2"
  storage_encrypted      = true

  db_name  = "smartparking"
  username = "smartparking"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "smart-parking-final-snapshot"

  deletion_protection = true
  multi_az            = false

  performance_insights_enabled = true

  tags = { Name = "smart-parking-postgres" }
}