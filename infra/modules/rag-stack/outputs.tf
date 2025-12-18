output "cloud_run_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.rag_api.uri
}

output "db_instance_connection_name" {
  description = "The connection name of the Cloud SQL instance"
  value       = google_sql_database_instance.instance.connection_name
}

output "db_private_ip" {
  description = "The private IP address of the database"
  value       = google_sql_database_instance.instance.private_ip_address
}

output "service_account_email" {
  description = "The email of the Cloud Run service account"
  value       = google_service_account.cloud_run_sa.email
}

output "artifact_registry_repo" {
  description = "The content of the repository"
  value       = google_artifact_registry_repository.repo.repository_id
}

output "upload_bucket_name" {
  description = "The name of the GCS bucket for uploads"
  value       = google_storage_bucket.upload_bucket.name
}

output "processing_topic_name" {
  description = "The name of the Pub/Sub topic for processing"
  value       = google_pubsub_topic.processing_topic.name
}
output "frontend_url" {
  description = "The URL of the deployed Frontend service"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_service_name" {
  value = google_cloud_run_v2_service.rag_api.name
}

output "frontend_service_name" {
  value = google_cloud_run_v2_service.frontend.name
}

output "client_id" {
  value = var.client_id
}
