terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
# NOTE: Cloud SQL API is sqladmin.googleapis.com
resource "google_project_service" "gcp_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "sqladmin.googleapis.com",            # For Cloud SQL
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "servicenetworking.googleapis.com",   # For Private Services Access
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
  ])
  project = var.project_id
  service = each.key
  disable_on_destroy = false
}
