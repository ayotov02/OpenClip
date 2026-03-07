# GCP Infrastructure Setup — Implementation Guide

## Overview
- **What:** Configure a GCP project with all required APIs, GPU quotas, networking, IAM roles, and base infrastructure for the OpenClip platform.
- **Why:** All AI model services run on GCP GPU instances (Cloud Run or Compute Engine). This setup is a prerequisite for every subsequent phase.
- **Dependencies:** None — this is the first step.

## Architecture

### GCP Project Structure
```
GCP Project: openclip-prod
├── APIs Enabled
│   ├── Cloud Run API
│   ├── Compute Engine API
│   ├── Cloud SQL Admin API
│   ├── Cloud Storage API (JSON)
│   ├── Memorystore for Redis API
│   ├── Artifact Registry API
│   ├── Cloud Build API
│   ├── Secret Manager API
│   ├── Cloud Logging API
│   ├── Cloud Monitoring API
│   ├── Serverless VPC Access API
│   └── Cloud Resource Manager API
│
├── Networking
│   ├── VPC: openclip-vpc
│   │   ├── Subnet: openclip-services (10.0.1.0/24, us-central1)
│   │   └── Subnet: openclip-gpu (10.0.2.0/24, us-central1)
│   ├── VPC Access Connector (for Cloud Run → private services)
│   ├── Cloud NAT (for private instances to reach internet)
│   ├── Cloud Router
│   └── Firewall Rules
│
├── IAM Service Accounts
│   ├── openclip-api@... (Cloud Run API service)
│   ├── openclip-worker@... (Compute Engine workers)
│   ├── openclip-build@... (Cloud Build)
│   └── openclip-storage@... (GCS access)
│
└── GPU Quotas
    ├── NVIDIA L4 GPUs: 4-8 (us-central1)
    └── NVIDIA T4 GPUs: 2-4 (fallback)
```

### Region Selection
- **Primary:** `us-central1` — Best L4 GPU availability, lowest cost
- **Fallback:** `us-east1`, `europe-west4` — For quota overflow
- **Criteria:** L4 GPU availability > cost > latency to users

## Step-by-Step Implementation

### Step 1: Create GCP Project
```bash
# Install gcloud CLI if not installed
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud auth application-default login

# Create project
gcloud projects create openclip-prod --name="OpenClip Production"
gcloud config set project openclip-prod

# Link billing account (required for GPU quotas)
gcloud billing accounts list
gcloud billing projects link openclip-prod --billing-account=BILLING_ACCOUNT_ID
```

### Step 2: Enable Required APIs
```bash
gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  servicenetworking.googleapis.com
```

### Step 3: Request GPU Quotas
```bash
# Check current quotas
gcloud compute regions describe us-central1 --format="table(quotas)"

# Request L4 GPU quota increase via Console:
# 1. Go to IAM & Admin > Quotas
# 2. Filter: "NVIDIA L4" and region "us-central1"
# 3. Request increase to 8 GPUs
# 4. Provide justification: "AI video processing platform requiring GPU inference"

# Also request for Cloud Run GPU (separate quota):
# Filter: "Cloud Run GPU allocation, per project per region"
# Request: 8 GPUs
```

**Expected approval time:** 1-3 business days for L4 GPUs.

### Step 4: Create VPC Network
```bash
# Create custom VPC
gcloud compute networks create openclip-vpc \
  --subnet-mode=custom

# Create subnets
gcloud compute networks subnets create openclip-services \
  --network=openclip-vpc \
  --region=us-central1 \
  --range=10.0.1.0/24

gcloud compute networks subnets create openclip-gpu \
  --network=openclip-vpc \
  --region=us-central1 \
  --range=10.0.2.0/24

# Create VPC Access Connector (for Cloud Run to connect to private services)
gcloud compute networks vpc-access connectors create openclip-connector \
  --region=us-central1 \
  --network=openclip-vpc \
  --range=10.8.0.0/28

# Create Cloud Router + NAT (for private instances to reach internet)
gcloud compute routers create openclip-router \
  --network=openclip-vpc \
  --region=us-central1

gcloud compute routers nats create openclip-nat \
  --router=openclip-router \
  --region=us-central1 \
  --nat-all-subnet-ip-ranges \
  --auto-allocate-nat-external-ips
```

### Step 5: Configure Firewall Rules
```bash
# Allow internal communication
gcloud compute firewall-rules create openclip-allow-internal \
  --network=openclip-vpc \
  --allow=tcp,udp,icmp \
  --source-ranges=10.0.0.0/16

# Allow SSH (for debugging Compute Engine instances)
gcloud compute firewall-rules create openclip-allow-ssh \
  --network=openclip-vpc \
  --allow=tcp:22 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=allow-ssh

# Allow health checks (required for load balancing)
gcloud compute firewall-rules create openclip-allow-health-checks \
  --network=openclip-vpc \
  --allow=tcp:8000,tcp:8001,tcp:8002,tcp:3000 \
  --source-ranges=130.211.0.0/22,35.191.0.0/16
```

### Step 6: Create IAM Service Accounts
```bash
# API service account
gcloud iam service-accounts create openclip-api \
  --display-name="OpenClip API Service"

# Worker service account
gcloud iam service-accounts create openclip-worker \
  --display-name="OpenClip Worker Service"

# Build service account
gcloud iam service-accounts create openclip-build \
  --display-name="OpenClip Build Service"

# Grant roles
PROJECT_ID=$(gcloud config get-value project)

# API: Cloud SQL client, Storage user, Secret accessor, Run invoker
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Worker: same as API plus Compute Engine access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Build: Artifact Registry writer, Cloud Run deployer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-build@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclip-build@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

### Step 7: Create Cloud SQL Instance
```bash
# Create PostgreSQL 16 instance
gcloud sql instances create openclip-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --network=openclip-vpc \
  --no-assign-ip \
  --storage-size=50GB \
  --storage-auto-increase \
  --backup-start-time=02:00 \
  --availability-type=zonal

# Create database
gcloud sql databases create openclip --instance=openclip-db

# Create user
gcloud sql users create openclip \
  --instance=openclip-db \
  --password=$(openssl rand -base64 32)
```

### Step 8: Create Memorystore Redis Instance
```bash
gcloud redis instances create openclip-redis \
  --size=2 \
  --region=us-central1 \
  --redis-version=redis_7_2 \
  --network=openclip-vpc \
  --connect-mode=PRIVATE_SERVICE_ACCESS

# Get the Redis host IP (needed for env vars)
gcloud redis instances describe openclip-redis --region=us-central1 --format="value(host)"
```

### Step 9: Create Cloud Storage Buckets
```bash
PROJECT_ID=$(gcloud config get-value project)

# Uploads bucket
gcloud storage buckets create gs://${PROJECT_ID}-uploads \
  --location=us-central1 \
  --uniform-bucket-level-access

# Processed outputs bucket
gcloud storage buckets create gs://${PROJECT_ID}-processed \
  --location=us-central1 \
  --uniform-bucket-level-access

# Model weights cache
gcloud storage buckets create gs://${PROJECT_ID}-models \
  --location=us-central1 \
  --uniform-bucket-level-access

# Temp bucket with lifecycle policy
gcloud storage buckets create gs://${PROJECT_ID}-temp \
  --location=us-central1 \
  --uniform-bucket-level-access

# Set lifecycle on temp bucket (delete after 1 day)
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 1}
      }
    ]
  }
}
EOF
gcloud storage buckets update gs://${PROJECT_ID}-temp --lifecycle-file=/tmp/lifecycle.json
```

### Step 10: Create Artifact Registry Repository
```bash
gcloud artifacts repositories create openclip-images \
  --repository-format=docker \
  --location=us-central1 \
  --description="OpenClip Docker images"

# Configure Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Step 11: Store Secrets
```bash
# Generate and store secrets
echo -n "$(openssl rand -base64 32)" | gcloud secrets create db-password --data-file=-
echo -n "$(openssl rand -base64 64)" | gcloud secrets create jwt-secret --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create api-encryption-key --data-file=-
echo -n "YOUR_PEXELS_API_KEY" | gcloud secrets create pexels-api-key --data-file=-

# Grant access to service accounts
for secret in db-password jwt-secret api-encryption-key pexels-api-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:openclip-api@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Step 12: Set Up Budget Alerts
```bash
# Via Console: Billing > Budgets & alerts
# Set budget: $500/month (development), $1500/month (production)
# Alerts at: 50%, 80%, 100%, 120%
# Email notifications to project owners
```

## Best Practices

- **Least privilege IAM:** Each service account should only have the roles it needs. Never use the default compute service account.
- **Private networking:** All inter-service communication should go through VPC. Only Cloud Run endpoints exposed via load balancer.
- **Secret Manager over env vars:** Never hardcode secrets. Always reference Secret Manager.
- **Budget alerts:** Set up alerts BEFORE deploying GPU workloads. L4 GPUs cost ~$0.70/hr.
- **Spot VMs for workers:** Use Spot/Preemptible VMs for Celery workers to save 60-91% on GPU costs.
- **Region consistency:** Keep all services in the same region to avoid cross-region egress charges.

## Testing

- **API enablement:** `gcloud services list --enabled` should show all required APIs
- **Network connectivity:** Create a test VM in each subnet, verify internal connectivity
- **Cloud SQL:** Connect from a test Cloud Run service using Cloud SQL Proxy
- **Redis:** Verify Memorystore connectivity from VPC Access Connector
- **Storage:** Upload/download test file to each bucket
- **IAM:** Verify each service account can access its required resources

## Verification Checklist
- [ ] GCP project created with billing linked
- [ ] All 13 APIs enabled
- [ ] GPU quota approved (L4 x 4-8 in us-central1)
- [ ] VPC with 2 subnets created
- [ ] VPC Access Connector created
- [ ] Cloud NAT configured
- [ ] Firewall rules: internal, SSH, health checks
- [ ] 3 service accounts with correct roles
- [ ] Cloud SQL PostgreSQL 16 instance running
- [ ] Memorystore Redis instance running
- [ ] 4 Cloud Storage buckets created (uploads, processed, models, temp)
- [ ] Temp bucket has 1-day lifecycle policy
- [ ] Artifact Registry repository created
- [ ] Secrets stored in Secret Manager
- [ ] Budget alerts configured
- [ ] All services in the same region (us-central1)
