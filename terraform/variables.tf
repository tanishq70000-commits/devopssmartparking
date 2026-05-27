variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "key_name" {
  type    = string
  default = "devops-key"
}

variable "ami_id" {
  type    = string
  default = "ami-053b0d53c279acc90"
  description = "Ubuntu 22.04 LTS in us-east-1"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "ChangeMe_Strong_Pass_2024!"
  description = "Password for the RDS PostgreSQL instance"
}