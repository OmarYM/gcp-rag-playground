
# ==================================================================================
# Deployment Script for GCP RAG Playground
# ==================================================================================
# Usage: ./deploy.ps1
# Prerequisites:
#   - gcloud CLI installed & authenticated
#   - Terraform installed
#   - Docker installed & running
# ==================================================================================

$ErrorActionPreference = "Stop"

Write-Host "[1/6] Initializing and Applying Terraform..." -ForegroundColor Cyan

# Check if terraform is working
if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    Write-Error "Terraform is not installed or not in PATH."
}

# Navigate to infra directory
Push-Location infra

# Initialize Terraform
terraform init

# Apply Terraform (creates/updates resources and outputs URLs)
# Auto-approve for non-interactive run
terraform apply -auto-approve

# Capture Outputs
$FrontendUrl = terraform output -raw frontend_url
$BackendUrl = terraform output -raw api_endpoint
$RepoId = terraform output -raw repository_id
$BackendServiceName = terraform output -raw backend_service_name
$FrontendServiceName = terraform output -raw frontend_service_name
$ClientId = terraform output -raw client_id

# Let's use gcloud to get the current project if we can't get it from TF easily without parsing raw state.
$ProjectID = (gcloud config get-value project)
$Region = "us-central1" # hardcoded default in terraform usually, verify match.
$RepoLocation = "$Region-docker.pkg.dev/$ProjectID/$RepoId"

Write-Host "Infrastructure Ready!" -ForegroundColor Green
Write-Host "   Frontend URL: $FrontendUrl"
Write-Host "   Backend URL:  $BackendUrl"
Write-Host "   Repo ID:      $RepoId"

Pop-Location # Back to root

# ==================================================================================

Write-Host "[2/6] Configuring Docker Auth..." -ForegroundColor Cyan
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

# ==================================================================================

Write-Host "[3/6] Building and Pushing Backend..." -ForegroundColor Cyan
$BackendImage = "$RepoLocation/backend:latest"
docker build -t $BackendImage ./backend
docker push $BackendImage

# ==================================================================================

Write-Host "[4/6] Deploying Backend Code..." -ForegroundColor Cyan
# We update the Cloud Run service with the new image
gcloud run deploy $BackendServiceName `
    --image $BackendImage `
    --region $Region `
    --project $ProjectID `
    --quiet

# ==================================================================================

Write-Host "[5/6] Building and Pushing Frontend..." -ForegroundColor Cyan
# Vite needs VITE_API_URL and VITE_GOOGLE_CLIENT_ID at build time
$FrontendImage = "$RepoLocation/frontend:latest"
docker build -t $FrontendImage `
  --build-arg VITE_API_URL=$BackendUrl `
  --build-arg VITE_GOOGLE_CLIENT_ID=$ClientId `
  ./frontend
docker push $FrontendImage

# ==================================================================================

Write-Host "[6/6] Deploying Frontend Code..." -ForegroundColor Cyan
gcloud run deploy $FrontendServiceName `
    --image $FrontendImage `
    --region $Region `
    --project $ProjectID `
    --allow-unauthenticated `
    --quiet

# ==================================================================================

Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "   Frontend: $FrontendUrl"
