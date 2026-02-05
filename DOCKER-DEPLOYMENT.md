# Docker Deployment Guide for Veritas Kanban

This guide explains how to deploy Veritas Kanban with Docker and Supabase.

## Architecture

The Docker container includes:

- **Frontend**: React SPA built with Vite (served as static files)
- **Backend**: Express API server (serves both API and frontend)
- **Database**: Supabase PostgreSQL (external, managed service)

## Prerequisites

1. **Supabase Account & Database**
   - Create a project at https://supabase.com
   - Apply the schema from `supabase-schema.sql` in the SQL Editor
   - Copy your Project URL and anon key

2. **Docker** installed on your system or deploy to:
   - Render.com (Docker deployment)
   - Railway.app
   - Fly.io
   - Any Docker-compatible platform

## Local Docker Deployment

### Step 1: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.docker .env
```

Edit `.env` and update these values:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `VERITAS_ADMIN_KEY` - Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `VERITAS_JWT_SECRET` - Generate: `openssl rand -hex 64`
- `CORS_ORIGINS` - Add your domain(s)

### Step 2: Build and Run

```bash
# Build and start the container
docker compose up --build

# Or run in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The app will be available at:

- **Web UI**: http://localhost:3001
- **API**: http://localhost:3001/api
- **API Docs**: http://localhost:3001/api-docs
- **Health Check**: http://localhost:3001/health

## Render.com Deployment

### Option 1: Using Render Blueprint (Recommended)

Create a `render.yaml` file (see below) and connect it to your repo.

### Option 2: Manual Setup

1. **Create a new Web Service** on Render
2. **Select "Docker" as the environment**
3. **Configure the service**:
   - **Name**: veritas-kanban
   - **Region**: Choose closest to your users
   - **Branch**: main (or your default branch)
   - **Docker Command**: (leave empty, uses Dockerfile CMD)

4. **Add Environment Variables** (in Render dashboard):

   ```
   NODE_ENV=production
   PORT=3001
   STORAGE_BACKEND=supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   VERITAS_ADMIN_KEY=your-admin-key-here
   VERITAS_JWT_SECRET=your-jwt-secret-here
   VERITAS_AUTH_ENABLED=true
   VERITAS_AUTH_LOCALHOST_BYPASS=false
   CORS_ORIGINS=https://your-app.onrender.com
   LOG_LEVEL=info
   ```

5. **Deploy** - Render will automatically build and deploy your Docker container

### Render Blueprint (render.yaml)

Create this file in your project root:

```yaml
services:
  - type: web
    name: veritas-kanban
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    plan: starter # or free
    region: oregon # or your preferred region
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: STORAGE_BACKEND
        value: supabase
      - key: SUPABASE_URL
        sync: false # Set manually in dashboard
      - key: SUPABASE_ANON_KEY
        sync: false # Set manually in dashboard
      - key: VERITAS_ADMIN_KEY
        generateValue: true
        sync: false
      - key: VERITAS_JWT_SECRET
        generateValue: true
        sync: false
      - key: VERITAS_AUTH_ENABLED
        value: true
      - key: VERITAS_AUTH_LOCALHOST_BYPASS
        value: false
      - key: CORS_ORIGINS
        value: https://veritas-kanban.onrender.com
      - key: LOG_LEVEL
        value: info
    healthCheckPath: /health
```

## Railway.app Deployment

1. **Create a new project** on Railway
2. **Deploy from GitHub** - connect your repo
3. **Add environment variables** (same as Render list above)
4. **Configure settings**:
   - Port: 3001
   - Health check path: `/health`
5. **Deploy**

## Fly.io Deployment

Create a `fly.toml`:

```toml
app = "veritas-kanban"
primary_region = "sea"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3001"
  STORAGE_BACKEND = "supabase"
  VERITAS_AUTH_ENABLED = "true"
  LOG_LEVEL = "info"

[[services]]
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.http_checks]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/health"
```

Deploy:

```bash
fly launch
fly secrets set SUPABASE_URL=your-url SUPABASE_ANON_KEY=your-key VERITAS_ADMIN_KEY=your-key VERITAS_JWT_SECRET=your-secret
fly deploy
```

## Verifying Deployment

### 1. Check Container Logs

Look for these startup messages:

```
✓ Storage backend initialized successfully
✓ Supabase client initialized
✓ Veritas Kanban Server started
```

### 2. Test API Connectivity

```bash
# Health check
curl https://your-app.onrender.com/health

# Test Supabase connection (should return tasks)
curl https://your-app.onrender.com/api/tasks \
  -H "X-API-Key: your-admin-key"
```

### 3. Access Web UI

Visit `https://your-app.onrender.com` in your browser. You should see:

- The Veritas Kanban web interface
- Tasks loading from Supabase
- No console errors

## Troubleshooting

### Tasks Not Showing Up

**Symptom**: Web UI loads but tasks list is empty

**Cause**: Frontend can't reach backend API

**Solution**:

1. Check browser console for CORS errors
2. Verify `CORS_ORIGINS` includes your deployed domain
3. Ensure you're accessing the app via the correct URL (not localhost)

### "Storage backend not initialized"

**Cause**: Supabase connection failed

**Solutions**:

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
2. Check Supabase project is active (not paused)
3. Verify database schema is applied (`supabase-schema.sql`)
4. Check Row Level Security policies are enabled

### Authentication Errors

**Cause**: Missing or invalid API keys

**Solutions**:

1. Generate new keys: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Set `VERITAS_ADMIN_KEY` in environment variables
3. For local testing, set `VERITAS_AUTH_LOCALHOST_BYPASS=true`

### CORS Errors

**Cause**: Frontend origin not whitelisted

**Solution**: Add your domain to `CORS_ORIGINS`:

```
CORS_ORIGINS=https://your-app.onrender.com,https://www.your-domain.com
```

## Environment Variables Reference

| Variable                        | Required    | Default    | Description                           |
| ------------------------------- | ----------- | ---------- | ------------------------------------- |
| `NODE_ENV`                      | Yes         | production | Node environment                      |
| `PORT`                          | Yes         | 3001       | Server port                           |
| `STORAGE_BACKEND`               | Yes         | file       | Use 'supabase' for production         |
| `SUPABASE_URL`                  | Yes\*       | -          | Your Supabase project URL             |
| `SUPABASE_ANON_KEY`             | Yes\*       | -          | Your Supabase anon key                |
| `VERITAS_ADMIN_KEY`             | Yes         | -          | Admin API key (min 32 chars)          |
| `VERITAS_JWT_SECRET`            | Recommended | auto       | JWT signing secret                    |
| `VERITAS_AUTH_ENABLED`          | No          | true       | Enable authentication                 |
| `VERITAS_AUTH_LOCALHOST_BYPASS` | No          | false      | Allow local access without auth       |
| `CORS_ORIGINS`                  | Yes         | localhost  | Comma-separated allowed origins       |
| `LOG_LEVEL`                     | No          | info       | Log verbosity (debug/info/warn/error) |
| `CLAWDBOT_GATEWAY`              | No          | -          | Clawdbot integration URL              |

\* Required when `STORAGE_BACKEND=supabase`

## Production Checklist

- [ ] Supabase database created and schema applied
- [ ] All environment variables set with secure values
- [ ] `VERITAS_AUTH_ENABLED=true` (do not disable in production)
- [ ] Strong `VERITAS_ADMIN_KEY` (64+ chars, randomly generated)
- [ ] `VERITAS_JWT_SECRET` set (prevents session loss on restart)
- [ ] `CORS_ORIGINS` includes only your actual domains
- [ ] `VERITAS_AUTH_LOCALHOST_BYPASS=false` (security)
- [ ] Health check endpoint responding: `/health`
- [ ] HTTPS enabled (handled by platform)
- [ ] Container logs show successful startup
- [ ] Web UI accessible and loading tasks
- [ ] API endpoints responding correctly

## Monitoring

### Health Checks

The container exposes a health endpoint at `/health`:

```bash
curl https://your-app.onrender.com/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T00:00:00.000Z",
  "uptime": 12345,
  "storage": "supabase",
  "database": "connected"
}
```

### Logs

View container logs:

```bash
# Docker Compose
docker compose logs -f

# Render
View in dashboard under "Logs" tab

# Railway
railway logs

# Fly.io
fly logs
```

### Metrics

Prometheus metrics available at `/metrics` endpoint.

## Backup & Recovery

### Supabase Backup

Supabase automatically backs up your database. You can also:

1. **Manual SQL Backup**:

   ```bash
   # In Supabase dashboard: Database → Backups → Download
   ```

2. **Export via API**:
   ```bash
   curl https://your-app.onrender.com/api/tasks \
     -H "X-API-Key: your-admin-key" > tasks-backup.json
   ```

### Container Persistence

The Docker container is **stateless** - all data is in Supabase. You can:

- Restart containers without data loss
- Scale horizontally
- Rebuild images safely

## Security Best Practices

1. **Never commit `.env` files** - they're in `.gitignore`
2. **Rotate API keys** regularly
3. **Use strong secrets** (64+ characters, random)
4. **Enable HTTPS** (handled by platform)
5. **Limit CORS origins** to your actual domains
6. **Keep dependencies updated**: `pnpm update`
7. **Monitor logs** for suspicious activity
8. **Backup database** regularly

## Performance Optimization

### Supabase Connection Pooling

For high traffic, enable connection pooling in your Supabase dashboard:

- Database → Settings → Connection Pooling
- Use the pooled connection string

### Container Resources

Recommended minimum:

- **CPU**: 0.5 vCPU
- **Memory**: 512 MB
- **Disk**: 1 GB (for logs/temp)

### Caching

The backend includes:

- HTTP ETag caching for API responses
- Static asset caching (1 year for hashed assets)
- Response compression (gzip/deflate)

## Support & Resources

- **Documentation**: See project README.md
- **API Docs**: Visit `/api-docs` on your deployed instance
- **Supabase Docs**: https://supabase.com/docs
- **Docker Docs**: https://docs.docker.com
- **Render Docs**: https://render.com/docs
