$ErrorActionPreference = "Stop"

$PROJECT_ID = gcloud config get-value project
$REGION = "asia-northeast1"
$REPO_NAME = "forge-ai"
$SECRET_NAME = "MONGO_URL"
$TRIGGER_NAME = "forge-backend-deploy"
$GITHUB_OWNER = "0xKlyyze"
$GITHUB_REPO = "forge-ai"

Write-Host "🚀 Setting up GCP Project: $PROJECT_ID in $REGION..."

# 1. Enable APIs
Write-Host "`n1️⃣  Enabling required APIs..."
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com

# 2. Artifact Registry
Write-Host "`n2️⃣  Checking Artifact Registry..."
$repoCheck = gcloud artifacts repositories list --location=$REGION --filter="name:projects/$PROJECT_ID/locations/$REGION/repositories/$REPO_NAME" --format="value(name)"
if (-not $repoCheck) {
    Write-Host "   Creating repository '$REPO_NAME'..."
    gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=$REGION --description="Docker repository for Forge AI"
} else {
    Write-Host "   Repository '$REPO_NAME' already exists."
}

# 3. Secret Manager
Write-Host "`n3️⃣  Checking Secret Manager..."
$secretCheck = gcloud secrets list --filter="name:$SECRET_NAME" --format="value(name)"
if (-not $secretCheck) {
    Write-Host "   Creating secret '$SECRET_NAME'..."
    "placeholder_value_replace_me" | gcloud secrets create $SECRET_NAME --data-file=-
    Write-Warning "⚠️  Secret created with PLACEHOLDER value. You Must update it!"
    Write-Warning "   Run: echo -n 'YOUR_CONNECTION_STRING' | gcloud secrets versions add $SECRET_NAME --data-file=-"
} else {
    Write-Host "   Secret '$SECRET_NAME' already exists."
}

# 4. IAM Permissions
Write-Host "`n4️⃣  Setting IAM Permissions..."
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$COMPUTE_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

Write-Host "   Granting 'Secret Accessor' to $COMPUTE_SA..."
# Use --quiet to avoid interactive prompts, and allow failure if binding already exists (though add-iam-policy-binding is usually idempotent)
gcloud secrets add-iam-policy-binding $SECRET_NAME --member="serviceAccount:$COMPUTE_SA" --role="roles/secretmanager.secretAccessor" --quiet

# 5. Cloud Build Trigger
Write-Host "`n5️⃣  Creating Cloud Build Trigger..."
$triggerCheck = gcloud builds triggers list --region=$REGION --filter="name:$TRIGGER_NAME" --format="value(name)"
if (-not $triggerCheck) {
    Write-Host "   Creating trigger '$TRIGGER_NAME'..."
    gcloud builds triggers create github --name=$TRIGGER_NAME --region=$REGION --repo-owner=$GITHUB_OWNER --repo-name=$GITHUB_REPO --branch-pattern="^main$" --build-config="backend/cloudbuild.yaml"
} else {
    Write-Host "   Trigger '$TRIGGER_NAME' already exists."
}

Write-Host "`n✅ Setup script finished!"
Write-Host "Next Steps:"
Write-Host "1. Update the Secret value if it was just created."
Write-Host "2. Push a change to 'main' OR run the trigger manually:"
Write-Host "   gcloud builds triggers run $TRIGGER_NAME --region=$REGION --branch=main"
