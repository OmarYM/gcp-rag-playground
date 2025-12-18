# --- Frontend Service (Cloud Run) ---

resource "google_cloud_run_v2_service" "frontend" {
  name     = "${var.prefix}-frontend"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    # Reuse the same SA or create a new one. For simplicity, reusing the run_sa (has permissions)
    # or better, create a separate one with less permissions.
    # Since frontend is public, let's just use the default compute SA or the one we made 
    # if it doesn't need special permissions. 
    # Frontend mainly sends requests to Backend (publicly or privately).
    # If public -> public, no special IAM needed.
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
      # Env vars (optional, mostly build-time for Vite, but could be runtime if using a server)
      env {
        name  = "VITE_API_URL" 
        value = google_cloud_run_v2_service.rag_api.uri
      }
    }
  }
}

# Allow unauthenticated access to Frontend
resource "google_cloud_run_v2_service_iam_member" "frontend_public_access" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
  project  = var.project_id
}
