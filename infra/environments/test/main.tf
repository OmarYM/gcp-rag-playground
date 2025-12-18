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
resource "google_project_service" "gcp_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "pubsub.googleapis.com",
  ])
  project = var.project_id
  service = each.key
  disable_on_destroy = false
}

module "rag_stack" {
  source = "../../modules/rag-stack" # Path to module

  project_id  = var.project_id
  region      = var.region
  prefix      = "${var.prefix}-test" # Differentiator
  db_password = var.db_password
  
  # Test environment settings
  tier = "db-f1-micro"
}
