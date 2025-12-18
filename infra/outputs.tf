output "api_endpoint" {
  description = "Public URL of the RAG API"
  value       = module.rag_stack.cloud_run_url
}

output "db_connection_name" {
  value = module.rag_stack.db_instance_connection_name
}

output "db_internal_ip" {
  value = module.rag_stack.db_private_ip
}

output "frontend_url" {
  description = "Public URL of the Frontend"
  value       = module.rag_stack.frontend_url
}

output "repository_id" {
  description = "Artifact Registry Repository ID"
  value       = module.rag_stack.artifact_registry_repo
}

output "backend_service_name" {
  value = module.rag_stack.backend_service_name
}

output "frontend_service_name" {
  value = module.rag_stack.frontend_service_name
}

output "client_id" {
  value = module.rag_stack.client_id
}
