output "api_endpoint" {
  value = module.rag_stack.cloud_run_url
}

output "db_connection_name" {
  value = module.rag_stack.db_instance_connection_name
}

output "db_internal_ip" {
  value = module.rag_stack.db_private_ip
}

output "upload_bucket" {
  value = module.rag_stack.upload_bucket_name
}

output "pubsub_topic" {
  value = module.rag_stack.processing_topic_name
}
