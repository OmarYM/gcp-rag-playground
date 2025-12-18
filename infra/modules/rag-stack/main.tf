# --- 1. Networking (VPC and PSA) ---

# Create a VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "${var.prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Create a Subnetwork (for general use)
resource "google_compute_subnetwork" "subnet" {
  name          = "${var.prefix}-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc_network.id
  project       = var.project_id
}

# Private Services Access (PSA) configuration for Cloud SQL
# This reserves an IP range for internal Google services (like Cloud SQL)
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# --- 2. Cloud SQL (PostgreSQL) ---

resource "google_sql_database_instance" "instance" {
  name             = "${var.prefix}-db-instance"
  region           = var.region
  database_version = "POSTGRES_15"
  project          = var.project_id

  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier = var.tier
    
    ip_configuration {
      ipv4_enabled    = false # Private IP only for security
      private_network = google_compute_network.vpc_network.id
    }


  }
  
  deletion_protection = false # For playground/dev only
}

resource "google_sql_database" "database" {
  name     = "rag_db"
  instance = google_sql_database_instance.instance.name
  project  = var.project_id
}

resource "google_sql_user" "users" {
  name     = "rag_user"
  instance = google_sql_database_instance.instance.name
  password = var.db_password
  project  = var.project_id
}

# --- 3. Compute Environment (Cloud Run) ---

# Artifact Registry
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "${var.prefix}-repo"
  description   = "Docker registry for RAG API"
  format        = "DOCKER"
  project       = var.project_id
}

# Service Account
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.prefix}-run-sa"
  display_name = "Service Account for RAG Cloud Run"
  project      = var.project_id
}

# IAM: Allow Cloud Run SA to connect to Cloud SQL
resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Allow Cloud Run SA to Publish/Subscribe
resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Allow Cloud Run SA to Read/Write Bucket
resource "google_storage_bucket_iam_member" "bucket_admin" {
  bucket = google_storage_bucket.upload_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Allow Cloud Run SA to sign URLs (Self-Impersonation for v4 Signing)
resource "google_service_account_iam_member" "token_creator_self" {
  service_account_id = google_service_account.cloud_run_sa.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# IAM: Vertex AI User (Access to Gemini Models)
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud Run Service (Placeholder)
resource "google_cloud_run_v2_service" "rag_api" {
  name     = "${var.prefix}-api"
  location = var.region
  project  = var.project_id
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run_sa.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder
      resources {
        cpu_idle = true
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
      env {
        name = "DB_HOST"
        value = google_sql_database_instance.instance.private_ip_address
      }
      env {
        name = "UPLOAD_BUCKET"
        value = google_storage_bucket.upload_bucket.name
      }
      env {
        name = "PROCESSING_TOPIC"
        value = google_pubsub_topic.processing_topic.name
      }
      env {
        name = "DB_USER"
        value = google_sql_user.users.name
      }
      env {
        name = "DB_PASSWORD"
        value = google_sql_user.users.password
      }
      env {
        name = "DB_NAME"
        value = google_sql_database.database.name
      }
      env {
        name = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name = "REGION"
        value = var.region
      }
      env {
        name = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLIENT_ID"
        value = var.client_id
      }
      env {
        name  = "STORAGE_MODE"
        value = "gcs"
      }
      env {
        name  = "INGESTION_MODE"
        value = "pubsub"
      }
      env {
        name  = "AI_PROVIDER"
        value = "vertex"
      }
      env {
        name  = "PUBSUB_PUSH_SERVICE_ACCOUNT"
        value = google_service_account.cloud_run_sa.email
      }
    }
    
    # Direct VPC Egress - Faster and Cheaper than VPC Connector
    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc_network.name
        subnetwork = google_compute_subnetwork.subnet.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }
  }
  
  # Wait for the VPC Peering to be established
  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Allow unauthenticated access (for playground testing)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.rag_api.location
  name     = google_cloud_run_v2_service.rag_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
  project  = var.project_id
}

# --- 4. Storage & Queue (Async Processing) ---

resource "google_storage_bucket" "upload_bucket" {
  name          = "${var.prefix}-uploads-${var.project_id}" 
  location      = var.region
  project       = var.project_id
  
  # Clean up bucket when destroying infrastructure (for playground safety)
  force_destroy = true 
  
  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_pubsub_topic" "processing_topic" {
  name    = "${var.prefix}-doc-processing"
  project = var.project_id
}

# Push Subscription: Pushes messages to the Cloud Run service
resource "google_pubsub_subscription" "push_subscription" {
  name    = "${var.prefix}-push-sub"
  topic   = google_pubsub_topic.processing_topic.name
  project = var.project_id

  # Cloud Run will receive POST requests at this endpoint
  push_config {
    push_endpoint = "${google_cloud_run_v2_service.rag_api.uri}/pubsub-webhook"
    
    oidc_token {
      service_account_email = google_service_account.cloud_run_sa.email
    }
  }
  
  depends_on = [google_cloud_run_v2_service.rag_api]
}
