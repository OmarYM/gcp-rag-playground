module "rag_stack" {
  source = "./modules/rag-stack"

  project_id  = var.project_id
  region      = var.region
  prefix      = var.prefix
  db_password = var.db_password
  client_id   = var.client_id
}
