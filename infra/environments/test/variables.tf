variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "prefix" {
  description = "Prefix for resources"
  type        = string
  default     = "rag" # Will result in rag-test-...
}

variable "db_password" {
  description = "DB Password"
  type        = string
  sensitive   = true
}
