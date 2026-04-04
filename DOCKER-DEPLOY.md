# Storyshot Creator — Docker Deployment Guide

Self-contained Docker deployment with **zero dependencies on Abacus.AI**.

## Prerequisites

- Docker Engine 20+ and Docker Compose v2+
- At least 2GB RAM available
- A Google Gemini API key (free tier: [aistudio.google.com](https://aistudio.google.com/app/apikey)) OR any OpenAI-compatible API key

## Quick Start

### 1. Clone / Copy the project

```bash
# If using Git:
git clone https://github.com/krocs2k/Storyboard-Prompt-Builder.git
cd Storyboard-Prompt-Builder
```

> **Note:** If `yarn.lock` is a symlink or missing, the Docker build will run a fresh `yarn install` to generate one. For reproducible builds, you can pre-generate it:
> ```bash
> yarn install   # creates yarn.lock locally
> ```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
# REQUIRED: Generate a unique secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# REQUIRED: Your deployment URL (use localhost for local dev)
NEXTAUTH_URL=http://localhost:3000

# REQUIRED: At least one LLM provider key
GEMINI_API_KEY=your-gemini-api-key

# RECOMMENDED: Change the default database password
POSTGRES_PASSWORD=your-secure-database-password
```

### 3. Build and run

```bash
docker compose up -d --build
```

This will:
1. Build the Next.js application
2. Start PostgreSQL 16
3. Run database migrations automatically
4. Seed the default admin user
5. Start the app on port 3000

### 4. Access the app

Open [http://localhost:3000](http://localhost:3000) and log in with:

- **Email:** `john@doe.com`
- **Password:** `johndoe123`

> ⚠️ **Change these credentials immediately** via the Admin panel after first login.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│   Next.js App    │ ────▶ │   PostgreSQL 16  │
│   (Port 3000)    │     │   (Port 5432)    │
└──────────────────┘     └──────────────────┘
        │                          │
        ▼                          ▼
┌──────────────────┐     ┌──────────────────┐
│  Docker Volume   │     │  Docker Volume   │
│  (storyboard-    │     │  (postgres-data) │
│   data)          │     │                  │
└──────────────────┘     └──────────────────┘
```

---

## What Replaced Abacus.AI Services

| Feature | Abacus.AI Platform | Docker Self-Hosted |
|---|---|---|
| **LLM API** | Abacus AI endpoint | Google Gemini / OpenAI / any OpenAI-compatible API |
| **Image Generation** | Abacus AI modalities API | Google Imagen (via Gemini key) or admin panel config |
| **Database** | Abacus-hosted PostgreSQL | Local PostgreSQL 16 container |
| **Email** | Abacus notification API | SMTP (Gmail, SendGrid, Mailgun, etc.) |
| **Authentication** | Abacus-managed NextAuth | Self-managed NextAuth with local credentials + optional Google SSO |
| **File Storage** | Abacus cloud storage | Docker volume (`storyboard-data`) |
| **Caching** | N/A | Optional Redis container |

---

## Configuration Reference

### LLM Provider Options

The app supports multiple AI providers. Configure via environment variables OR the Admin panel:

#### Google Gemini (Recommended)
```env
GEMINI_API_KEY=your-key
```
Free tier includes generous limits. Supports both text (Gemini Flash) and image generation (Imagen).

#### OpenAI / Compatible API
```env
LLM_API_KEY=sk-...
LLM_API_BASE_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o
```

#### Local LLM (Ollama, LM Studio, etc.)
```env
LLM_API_KEY=not-needed
LLM_API_BASE_URL=http://host.docker.internal:11434/v1/chat/completions
LLM_MODEL=llama3.1
```

> **Note:** You can also configure providers at runtime through **Admin > API Configuration** in the web UI.

### Email (SMTP)

Required for email verification and user invitations. Without it, emails are logged to console.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=noreply@yourdomain.com
```

> For Gmail, use [App Passwords](https://support.google.com/accounts/answer/185833).

### Google SSO (Optional)

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

Or configure via **Admin > Google SSO** in the web UI.

### Redis Caching (Optional)

Uncomment the `redis` service in `docker-compose.yml`, then:

```env
REDIS_URL=redis://redis:6379
```

Or configure via **Admin > Redis** in the web UI.

---

## Operations

### View logs
```bash
docker compose logs -f app
docker compose logs -f db
```

### Restart the app
```bash
docker compose restart app
```

### Stop everything
```bash
docker compose down
```

### Rebuild after code changes
```bash
docker compose up -d --build app
```

### Database backup
```bash
docker compose exec db pg_dump -U spb_user storyboard_prompt_builder > backup.sql
```

### Database restore
```bash
cat backup.sql | docker compose exec -T db psql -U spb_user storyboard_prompt_builder
```

### Reset database (destructive!)
```bash
docker compose down -v  # removes all volumes
docker compose up -d --build
```

### Storyboard image data
Images are stored in the `storyboard-data` Docker volume mounted at `/app/data`.

To back up:
```bash
docker run --rm -v storyboard-data:/data -v $(pwd):/backup alpine tar czf /backup/images-backup.tar.gz /data
```

---

## Production Deployment

For production, ensure:

1. **Change default passwords:**
   - Set a strong `POSTGRES_PASSWORD`
   - Change the default admin credentials after first login
   - Generate a proper `NEXTAUTH_SECRET`

2. **Set correct URL:**
   ```env
   NEXTAUTH_URL=https://yourdomain.com
   ```

3. **Use a reverse proxy** (Nginx, Caddy, Traefik) for HTTPS:
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Restrict database port** — remove `ports: - '5432:5432'` from `docker-compose.yml` in production.

5. **Enable email** — configure SMTP for user invitations and email verification.

---

## Troubleshooting

### "No LLM API key configured"
Set `GEMINI_API_KEY` in `.env` or configure via Admin > API Configuration.

### Database connection errors
Ensure the `db` service is healthy: `docker compose ps`

### Prisma migration errors
Force a fresh migration:
```bash
docker compose exec app npx prisma db push --force-reset
```

### Images not persisting
Ensure the `storyboard-data` volume is mounted correctly in `docker-compose.yml`.

### Build fails on ARM (Apple Silicon)
The Dockerfile includes both `linux-musl-openssl-3.0.x` (amd64) and `linux-musl-arm64-openssl-3.0.x` (arm64) Prisma binary targets.
