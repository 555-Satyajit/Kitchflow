# KitchenOS — Standalone Persistent Node.js Server Deployment Guide

> **Target Architecture:** Standalone Node.js server (24/7 warm process, persistent connection pooling, zero serverless cold starts)  
> **Recommended Hosting:** AWS EC2 / Lightsail (Mumbai `ap-south-1`), Railway, DigitalOcean (Bangalore), Render, or VPS.

---

## 1. Why Standalone Node.js Over Serverless?

| Feature | Serverless (Vercel) | Standalone Node.js (VPS/Railway/Docker) |
| :--- | :--- | :--- |
| **Cold Starts** | 1.5s – 3.0s delay when idle | **0ms (Always running 24/7)** |
| **DB Connection Pool** | Re-connected & TLS re-negotiated every click | **Persistent warm connection pool kept alive** |
| **Latency in India** | Unpredictable (1,000ms – 2,500ms) | **20ms – 50ms (in Mumbai/Bangalore)** |
| **Realtime Sync** | Flapping / disconnected WebSocket lifecycles | **Continuous uninterrupted connection** |

---

## 2. Deployment Options

### Option A: 1-Click Cloud (Railway / Render)
1. Link your GitHub repository to [Railway](https://railway.app) or [Render](https://render.com).
2. Choose **Docker** or **Node.js** service.
3. Railway automatically detects `Dockerfile` and builds the standalone server.
4. Add your environment variables (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AUTH_SECRET`).
5. Set deployment region to **Asia South (Mumbai)** or **Singapore**.

---

### Option B: Dedicated VPS (Ubuntu via Docker / PM2)

#### 1. Using Docker (Simplest & Cleanest)
```bash
# Clone the repository
git clone <your-repo-url> kitchenos
cd kitchenos

# Create .env with production database credentials
cp .env.example .env

# Build and start container (runs 24/7 with auto-restart on boot)
docker compose up -d --build
```

#### 2. Using PM2 (Native Node.js)
```bash
pnpm install --frozen-lockfile
npx prisma generate
pnpm build

# Start the standalone server with PM2 cluster mode
pm2 start .next/standalone/server.js --name kitchenos -i max
pm2 save
pm2 startup
```

---

## 3. Verification

Once deployed:
- Test an order status update or KDS punch on a mobile phone.
- Response time should be consistent at **<50ms** with zero cold start delays.

