# JadeHandForward Deployment Guide

## Vercel Deployment

This project is configured as a monorepo with both frontend (static HTML) and backend (Node.js/Express) in a single deployment.

### Environment Variables Required in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these for **Production**:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-api03-...
APP_URL=https://your-domain.vercel.app
NODE_ENV=production
PORT=3001
```

**Note**: Use the actual keys from your `.env` file locally. Never commit real keys to Git.

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add frontend-backend integration"
   git push origin main
   ```

2. **Vercel Auto-Deploy**
   - Vercel will automatically build and deploy
   - Frontend: Serves `index.html` and `hunters.html`
   - Backend: Routes `/api/*` to Express server

3. **After Deployment**
   - Get your Vercel URL (e.g., `jadehandforward.vercel.app`)
   - Update `APP_URL` env var in Vercel to your deployed URL
   - Configure Stripe webhook: `https://your-domain.vercel.app/api/coins/webhook`
   - Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel

### Supabase Realtime (Optional)

Enable Realtime in Supabase Dashboard → Database → Replication:
- `bids`
- `auction_lots`
- `auctions`
- `marketplace_listings`

### Testing After Deployment

- Frontend: `https://your-domain.vercel.app`
- Backend API: `https://your-domain.vercel.app/api/health`
- Live Auction: `https://your-domain.vercel.app/api/auction/live`
- AI Agent: `https://your-domain.vercel.app/api/agent/chat`

### Architecture

```
jadehandforward.vercel.app/
├── / (index.html) - Buyer platform
├── /hunters.html - Hunter registration
└── /api/* - Backend API (Express)
    ├── /api/auth/*
    ├── /api/coins/*
    ├── /api/auction/*
    ├── /api/hunters/*
    ├── /api/agent/*
    └── /api/marketplace/*
```

## Local Development

```bash
# Frontend (open in browser)
open index.html

# Backend
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`
Frontend calls localhost API when running locally.
