variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources"
  type        = string
  default     = "us-central1"
}

variable "prefix" {
  description = "A unique prefix for all resource names"
  type        = string
  default     = "rag-expert"
}

variable "db_password" {
  description = "Password for the database user"
  type        = string
  sensitive   = true
}

variable "tier" {
  description = "The machine tier (vCPU) for Cloud SQL"
  type        = string
  default     = "db-f1-micro"
}

variable "client_id" {
  description = "Google OAuth Client ID"
  type        = string
}
