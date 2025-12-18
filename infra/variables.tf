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
  description = "The password for the Cloud SQL user"
  type        = string
  sensitive   = true
}

variable "client_id" {
  description = "Google OAuth Client ID"
  type        = string
}
