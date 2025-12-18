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
  source = "../../modules/rag-stack"

  project_id  = var.project_id
  region      = var.region
  prefix      = "${var.prefix}-prod"
  db_password = var.db_password
  
  # Production environment settings
  # NOTE: Using micro for now to save cost, but in real Prod use "db-custom-1-3840"
  tier = "db-f1-micro" 
}
