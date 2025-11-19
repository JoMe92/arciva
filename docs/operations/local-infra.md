# Local Infrastructure — Linux Install Guide (No Docker)

> Goal: Set up everything you need to run the app locally **without containers**. This is a concise, English quick-start with **Linux commands**. We intentionally **do not** cover Git, VS Code or OpenSSL here per your note.

---

## 0) Supported distros & notation
Examples below show commands for **Ubuntu/Debian** first, with notes for **Fedora/RHEL** and **Arch**.

- Ubuntu/Debian: `apt`, services via `systemctl`
- Fedora/RHEL: use `dnf` instead of `apt`
- Arch: use `pacman` instead of `apt`

You’ll need `sudo` privileges.

---

## 1) Python 3.11+ and Conda/Miniconda
### Option A (recommended): Miniconda
**Install Miniconda (x86_64; adjust for ARM if needed):**
```bash
# Download the latest Miniconda installer
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh
bash ~/miniconda.sh -b -p $HOME/miniconda
# Initialize shell
$HOME/miniconda/bin/conda init
exec "$SHELL"
```
**Create & activate a project env (Python 3.11):**
```bash
conda create -n photoapp python=3.11 -y
conda activate photoapp
```

### Option B: System Python + venv
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y python3.11 python3.11-venv
python3.11 -m venv .venv
source .venv/bin/activate
```
> Choose either Conda **or** venv, not both.

---

## 2) Node.js LTS and pnpm
### Via nvm (portable; recommended)
```bash
# Install nvm
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
exec "$SHELL"
# Install latest LTS Node
nvm install --lts
# Enable pnpm via corepack (Node ≥16.13)
corepack enable
corepack prepare pnpm@latest --activate
```

### Distro packages (alternative)
- Ubuntu/Debian: use Nodesource or `snap` (not shown here); pnpm: `npm i -g pnpm`
- Fedora: `sudo dnf install nodejs` then `npm i -g pnpm`
- Arch: `sudo pacman -S nodejs npm` then `npm i -g pnpm`

---

## 3) Image & metadata tools
### libvips (fast thumbnails; preferred)
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y libvips
# Fedora/RHEL
sudo dnf install -y vips
# Arch
sudo pacman -S --noconfirm vips
```

### (Optional) ImageMagick (if you prefer)
```bash
# Ubuntu/Debian
sudo apt install -y imagemagick
# Fedora/RHEL
sudo dnf install -y imagemagick
# Arch
sudo pacman -S --noconfirm imagemagick
```

### ExifTool
```bash
# Ubuntu/Debian
sudo apt install -y libimage-exiftool-perl
# Fedora/RHEL
sudo dnf install -y perl-Image-ExifTool
# Arch
sudo pacman -S --noconfirm exiftool
```

---

## 4) PostgreSQL (database for metadata)
Install server + CLI, create a dedicated DB and user.
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y postgresql postgresql-client
# Start & enable service
sudo systemctl enable --now postgresql
# Create role & database (replace PASSWORD)
sudo -u postgres createuser --pwprompt photoapp   # set a password
sudo -u postgres createdb -O photoapp photoapp_dev
# Test connection (you will be prompted for the password)
psql -h 127.0.0.1 -U photoapp -d photoapp_dev -c "select version();"
```
**Defaults to note:** host `127.0.0.1`, port `5432`, DB `photoapp_dev`, user `photoapp`.

Fedora/RHEL: `sudo dnf install postgresql-server postgresql`, then `sudo postgresql-setup --initdb` and enable service.

Arch: `sudo pacman -S postgresql`, then initdb + enable service per Arch wiki.

---

## 5) Redis (task queue broker)
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
# Quick ping test
redis-cli ping   # should print PONG
```
Fedora/RHEL: `sudo dnf install redis` then `sudo systemctl enable --now redis`.

Arch: `sudo pacman -S redis` then enable service.

---

## 6) Object storage: choose one
### A) MinIO (S3-compatible; preferred)
**Install MinIO server & client:**
```bash
# Download server binary (x86_64; see min.io for ARM)
wget https://dl.min.io/server/minio/release/linux-amd64/minio -O ~/bin/minio
chmod +x ~/bin/minio
# (Optional) MinIO Client
wget https://dl.min.io/client/mc/release/linux-amd64/mc -O ~/bin/mc
chmod +x ~/bin/mc
```
**Run MinIO locally (separate terminal):**
```bash
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
mkdir -p $HOME/minio-data
~/bin/minio server $HOME/minio-data --console-address ":9090" --address ":9000"
```
**Create buckets (new terminal):**
```bash
# Set alias
~/bin/mc alias set local http://127.0.0.1:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
# Buckets used by the app
~/bin/mc mb local/uploads
~/bin/mc mb local/originals
~/bin/mc mb local/derivatives
```
**Environment you’ll need:**
```
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_ORIGINALS=originals
S3_BUCKET_DERIVATIVES=derivatives
S3_USE_SSL=false
```

### B) POSIX filesystem (transition option)
```bash
# Create directories with write access
mkdir -p $HOME/arciva-data/{db,media/uploads,media/originals,media/derivatives,media/exports}
```
**Environment you’ll need:**
```
APP_DB_PATH=$HOME/arciva-data/db/app.db
APP_MEDIA_ROOT=$HOME/arciva-data/media
```
> Implement a storage adapter in the app so MinIO ⇄ POSIX is just config.

---

## 7) Environment variables (project-wide)
Create a **`.env`** in the repo root based on `.env.example` with at least:
```
# Runtime data
APP_DB_PATH=/app-data/db/app.db
APP_MEDIA_ROOT=/app-data/media

# Redis
REDIS_URL=redis://127.0.0.1:6379/0

# Object storage (pick one variant)
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_ORIGINALS=originals
S3_BUCKET_DERIVATIVES=derivatives
S3_USE_SSL=false

# App
APP_ENV=dev
SECRET_KEY=REPLACE_ME
JWT_SIGNING_KEY=REPLACE_ME
ALLOWED_ORIGINS=http://localhost:5173
THUMB_SIZES=128,256,512
MAX_UPLOAD_MB=200
WORKER_CONCURRENCY=2

# Frontend
VITE_API_BASE_URL=http://127.0.0.1:8000
```

---

## 8) Default ports (change if they clash)
- Frontend (Vite): **5173**
- Backend API: **8000** (dev)
- PostgreSQL: **5432**
- Redis: **6379**
- MinIO API: **9000**, MinIO Console: **9090**

---

## 9) Quick smoke test (after installs)
```bash
# 1) Services running?
# - PostgreSQL active
# - Redis active
# - MinIO running with buckets (or POSIX dirs exist)

# 2) Backend env loaded (.env in repo root)
# 3) Start backend API (one terminal)  -> should bind on :8000
# 4) Start worker (second terminal)    -> should connect to Redis & storage
# 5) Start frontend (third terminal)   -> http://localhost:5173
# 6) In the app: create a Project, upload a small image, see thumbnail
```

---

## 10) Troubleshooting cheatsheet
- **Port already in use** → change the service port and update `.env`.
- **DB auth errors** → verify user/password; can you `psql` with them?
- **Redis connection refused** → service not started or wrong port.
- **MinIO 403/NoSuchBucket** → access keys wrong or buckets not created.
- **POSIX write denied** → fix directory ownership/permissions.

---

*File location:* `infra/local/INSTALL.md`
