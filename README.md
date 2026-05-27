# 🚗 Smart Parking System — Enterprise Microservices

A production-grade, cloud-native Smart Parking System built with microservices architecture and full DevOps tooling — designed for deployment on **AWS EC2**.

---

## 📐 Architecture Overview

```
Client (Web/Mobile)
        │
        ▼
AWS Application Load Balancer (Port 80/443)
        │
        ▼
API Gateway (Nginx — Port 8000)
  ├─► /api/auth/       → Auth Service         (JWT, bcrypt)
  ├─► /api/users/      → User Service         (Profiles, Vehicles)
  ├─► /api/slots/      → Parking Slot Service (Redis cache, PostgreSQL)
  ├─► /api/bookings/   → Booking Service      (PostgreSQL, RabbitMQ)
  ├─► /api/payments/   → Payment Service      (Fee calc, RabbitMQ)
  ├─► /api/notif/      → Notification Service (RabbitMQ Consumer)
  ├─► /api/tracking/   → Vehicle Tracking     (WebSocket, Redis)
  ├─► /api/analytics/  → Analytics Service    (Revenue, Events)
  └─► /admin/          → Admin Dashboard      (Django)

Infrastructure:
  PostgreSQL ──── Bookings, Auth, Users, Payments
  Redis       ──── Slot cache, Location cache
  RabbitMQ    ──── Event bus (booking.created, payment.completed)
```

---

## 📁 Project Structure

```
SmartParking/
├── services/                    # All 10 microservices
│   ├── api-gateway/             # Nginx reverse proxy
│   ├── auth-service/            # JWT auth (Node.js)
│   ├── user-service/            # User profiles (Node.js)
│   ├── parking-slot-service/    # Slot management (FastAPI + Redis)
│   ├── booking-service/         # Reservations (Node.js + RabbitMQ)
│   ├── payment-service/         # Payments (Node.js + RabbitMQ)
│   ├── notification-service/    # Alerts (Node.js + RabbitMQ consumer)
│   ├── vehicle-tracking-service/# GPS + WebSocket (FastAPI)
│   ├── analytics-service/       # Reports (FastAPI + RabbitMQ consumer)
│   └── admin-dashboard/         # Web UI (Django)
├── k8s/                         # Kubernetes manifests
│   ├── namespace.yaml
│   ├── deployments.yaml
│   ├── services.yaml
│   ├── ingress.yaml / ingress-tls.yaml
│   ├── configmap.yaml / secrets.yaml
│   ├── hpa.yaml                 # Horizontal Pod Autoscalers
│   ├── persistent-volumes.yaml  # PV + PVC
│   ├── network-policies.yaml    # Zero-trust networking
│   ├── rbac.yaml                # Role-Based Access Control
│   ├── cert-manager.yaml        # TLS via Let's Encrypt
│   ├── databases.yaml           # PostgreSQL + Redis
│   └── rabbitmq.yaml
├── helm/                        # Helm chart
├── terraform/                   # AWS IaC
│   ├── main.tf                  # EC2, VPC, Networking
│   ├── rds.tf                   # RDS PostgreSQL
│   ├── s3.tf                    # S3 + IAM
│   └── elasticache.tf           # ElastiCache Redis
├── ansible/                     # EC2 provisioning playbook
├── observability/               # Full monitoring stack
│   ├── prometheus/              # Metrics + Alert rules
│   ├── grafana/                 # Dashboards + Datasources
│   ├── loki/                    # Log aggregation
│   ├── promtail/                # Log scraping
│   ├── alertmanager/            # Slack + Email alerts
│   └── jaeger/                  # Distributed tracing
├── docker-compose.yml           # Local dev stack
├── docker-compose.prod.yml      # EC2 production stack
└── docker-compose.observability.yml # Full monitoring stack
```

---

## 🚀 Quick Start — Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local service development)
- Python 3.11+ (for local service development)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_ORG/smart-parking.git
cd smart-parking
```

### 2. Start all services
```bash
docker compose up --build
```

### 3. Services will be available at:

| Service              | URL                          |
|----------------------|------------------------------|
| API Gateway          | http://localhost:8000        |
| Auth Service         | http://localhost:8001        |
| User Service         | http://localhost:8002        |
| Parking Slot Service | http://localhost:8003        |
| Booking Service      | http://localhost:8004        |
| Payment Service      | http://localhost:8005        |
| Notification Service | http://localhost:8006        |
| Vehicle Tracking     | http://localhost:8007        |
| Analytics Service    | http://localhost:8008        |
| Admin Dashboard      | http://localhost:8080        |
| RabbitMQ Management  | http://localhost:15672       |

### 4. Start observability stack
```bash
docker compose -f docker-compose.observability.yml up -d
```

| Tool       | URL                           | Credentials             |
|------------|-------------------------------|-------------------------|
| Grafana    | http://localhost:3000         | admin / smartparking_grafana |
| Prometheus | http://localhost:9090         | —                        |
| Jaeger     | http://localhost:16686        | —                        |
| Alertmanager | http://localhost:9093       | —                        |

---

## ☁️ EC2 Deployment

### Option A: Ansible (Recommended)

1. Add your EC2 public IP to `ansible/inventory.ini`
2. Run the playbook:
```bash
ansible-playbook -i ansible/inventory.ini ansible/provision_ec2.yml
```
This automatically installs Docker, Docker Compose, K3s, clones the repo, and starts all containers.

### Option B: Terraform + Manual

```bash
cd terraform
terraform init
terraform plan
terraform apply
```
The EC2 instance will auto-install Docker and K3s via User Data on first boot.

---

## ☸️ Kubernetes Deployment (K3s on EC2)

```bash
# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/persistent-volumes.yaml
kubectl apply -f k8s/databases.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/deployments.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/network-policies.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/ingress.yaml

# Or apply everything at once
kubectl apply -f k8s/

# With Helm
helm install smart-parking ./helm
```

### TLS (Let's Encrypt)
```bash
# Install cert-manager first
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Then apply TLS ingress
kubectl apply -f k8s/cert-manager.yaml
kubectl apply -f k8s/ingress-tls.yaml
```

---

## 🔌 API Reference

### Auth Service (Port 8001)

| Method | Endpoint    | Body                              | Description        |
|--------|-------------|-----------------------------------|--------------------|
| POST   | /register   | `{email, password, role?}`       | Register user      |
| POST   | /login      | `{email, password}`              | Login → JWT token  |
| POST   | /verify     | Header: `Authorization: Bearer <token>` | Validate token |

### Parking Slot Service (Port 8003)

| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| GET    | /slots                      | All slots (Redis cached)  |
| GET    | /slots/available            | Available slots count     |
| POST   | /slots/{number}/occupy      | Mark slot occupied        |
| POST   | /slots/{number}/release     | Free a slot               |

### Booking Service (Port 8004)

| Method | Endpoint               | Body                                        | Description     |
|--------|------------------------|---------------------------------------------|-----------------|
| POST   | /bookings              | `{user_id, slot_number, vehicle_number}`   | Create booking  |
| GET    | /bookings/:id          | —                                           | Get booking     |
| PATCH  | /bookings/:id/cancel   | —                                           | Cancel booking  |

### Payment Service (Port 8005)

| Method | Endpoint                       | Body                                  | Description   |
|--------|--------------------------------|---------------------------------------|---------------|
| POST   | /payments                      | `{booking_id, entry_time, exit_time}` | Process payment|
| GET    | /payments/booking/:booking_id  | —                                     | Get payment   |

> **Fee structure:** ₹20 for first hour, ₹10 per additional 30 minutes.

### Vehicle Tracking Service (Port 8007)

| Method    | Endpoint                             | Description                 |
|-----------|--------------------------------------|-----------------------------|
| POST      | /locations                           | Update vehicle GPS location |
| GET       | /locations/{vehicle}/latest          | Latest position             |
| GET       | /locations/{vehicle}/history         | Location history            |
| GET       | /locations/active                    | All active vehicles         |
| WebSocket | ws://localhost:8007/ws/track/{plate} | Real-time GPS stream        |

---

## 🧪 Running Tests

### Node.js services
```bash
cd services/auth-service && npm install && npm test
cd services/user-service && npm install && npm test
cd services/booking-service && npm install && npm test
cd services/payment-service && npm install && npm test
cd services/notification-service && npm install && npm test
```

### Python services
```bash
cd services/parking-slot-service
pip install -r requirements.txt
pytest

cd services/analytics-service
pip install -r requirements.txt
pytest
```

---

## 🔐 Security

- **JWT Authentication** — stateless auth via Auth Service
- **Rate Limiting** — Nginx enforces 30 req/s per IP
- **TLS/HTTPS** — cert-manager + Let's Encrypt (K8s)
- **Network Policies** — zero-trust: default deny-all, explicit allow rules
- **RBAC** — Kubernetes roles restrict API access
- **Secrets** — Kubernetes Secrets (base64-encoded)
- **Container scanning** — Trivy runs on every CI build
- **Dependency audit** — `npm audit` runs in CI pipeline

---

## 📊 Monitoring

After starting the observability stack:

- **Grafana** → `http://localhost:3000` — Dashboards for request rates, error rates, latency
- **Prometheus** → `http://localhost:9090` — Raw metrics + alerting rules
- **Jaeger** → `http://localhost:16686` — Distributed request traces
- **Loki** → Queried via Grafana — Centralized logs from all containers
- **Alertmanager** → `http://localhost:9093` — Routes alerts to Slack and email

### Configured Alert Rules
| Alert | Condition | Severity |
|-------|-----------|----------|
| ServiceDown | service unreachable for 1 min | critical |
| HighCPUUsage | CPU > 80% for 5 min | warning |
| HighMemoryUsage | Memory > 512MB for 5 min | warning |
| HighHTTPErrorRate | 5xx rate > 5% for 2 min | critical |
| HighRequestLatency | P95 > 2s for 5 min | warning |
| RabbitMQQueueGrowing | Queue messages > 1000 | warning |

---

## 🔄 CI/CD Pipeline

### CI (on every push/PR to `main` or `develop`)
1. ✅ Lint Node.js and Python services
2. ✅ Run unit tests for all services
3. ✅ Trivy container vulnerability scan
4. ✅ `npm audit` dependency scan
5. ✅ Build Docker images
6. ✅ Push to GitHub Container Registry (GHCR)

### CD (on push to `main`)
1. SSH into EC2 instance
2. `git pull` latest code
3. `docker compose pull` latest images
4. `docker compose up -d` with zero-downtime restart
5. Health check — auto-rollback if `/health` returns non-200
6. Slack notification on success or failure

### Required GitHub Secrets
| Secret | Value |
|--------|-------|
| `EC2_SSH_KEY` | EC2 `.pem` private key content |
| `EC2_HOST` | EC2 public IP address |
| `SLACK_WEBHOOK` | Slack incoming webhook URL |

---

## 🏗️ Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feature/*` | New features (PR → develop) |
| `hotfix/*` | Emergency patches (PR → main + develop) |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| API Gateway | Nginx 1.27 |
| Auth / Booking / Payment / Notification / User | Node.js 20 + Express |
| Parking Slots / Analytics / Tracking | Python 3.11 + FastAPI |
| Admin Dashboard | Python 3.11 + Django |
| Message Broker | RabbitMQ 3.13 |
| Cache | Redis 7 |
| Database | PostgreSQL 16 |
| Container Runtime | Docker + Docker Compose |
| Orchestration | Kubernetes (K3s on EC2) |
| Package Manager (K8s) | Helm |
| IaC | Terraform |
| Provisioning | Ansible |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + Grafana |
| Logging | Loki + Promtail |
| Tracing | Jaeger |
| Alerting | Alertmanager |
| Security Scanning | Trivy |
| Cloud | AWS (EC2, RDS, ElastiCache, S3) |
