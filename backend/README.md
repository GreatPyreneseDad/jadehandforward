# JadeHandForward Backend

Natural jade only · Never quarried

## Stack

- **Runtime**: Node.js 20+
- **Framework**: Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **AI**: Anthropic Claude Sonnet 4
- **Auth**: Supabase Auth (Magic Links)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_KEY` - Supabase service role key (admin)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `ANTHROPIC_API_KEY` - Anthropic API key
- `APP_URL` - Frontend URL (for CORS and redirects)
- `PORT` - API server port (default: 3001)

### 3. Initialize Database

Run the schema in Supabase SQL Editor:

```bash
# Copy contents of supabase-schema.sql into Supabase SQL Editor
# Execute to create tables, views, and RLS policies
```

Enable Realtime for these tables in Supabase Dashboard:
- `auctions`
- `auction_lots`
- `bids`

### 4. Configure Stripe Webhook

1. In Stripe Dashboard, add webhook endpoint: `https://your-api.com/api/coins/webhook`
2. Select event: `payment_intent.succeeded`
3. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Send magic link email
- `GET /api/auth/me` - Get current user + profile + balance

### Coins
- `POST /api/coins/checkout` - Create Stripe payment intent
- `POST /api/coins/webhook` - Stripe webhook (raw body)
- `GET /api/coins/balance` - Get user coin balance

### Hunters
- `POST /api/hunters/register` - Register as jade hunter/seller (public)

### Agent
- `POST /api/agent/chat` - Chat with jade AI agent

### Auctions
- `GET /api/auction/live` - Get currently live auction
- `GET /api/auction/:id` - Get specific auction by ID
- `POST /api/auction/:id/bid` - Place bid on lot

### Health
- `GET /health` - Health check

## Architecture

### Coin System
- Double-entry ledger in `coin_ledger` table
- 24-hour hold period before coins eligible for bidding
- View `eligible_coins` calculates eligible balance per user

### Bidding Flow
1. Verify user has eligible coins (held > 24 hours)
2. Verify auction is live and lot is open
3. Verify bid exceeds current price
4. Create bid record with `status: 'winning'`
5. Hold coins via negative ledger entry (`type: 'bid_hold'`)
6. Release previous winner's hold (positive ledger entry `type: 'bid_release'`)
7. Mark previous bid as `status: 'outbid'`
8. Update lot with new price and winning bid

### Authentication
- Magic link authentication via Supabase Auth
- JWT tokens verified via `requireAuth` middleware
- Service client bypasses RLS for admin operations
- User client factory creates RLS-enabled clients

### Row Level Security
- Profiles: Users can only read own profile
- Coin ledger: Users can only read own transactions
- Bids: Users can only create own bids, read all bids
- Hunter registrations: Users can only read own registrations

## Deployment

### Railway

```bash
railway login
railway init
railway add
railway up
```

Add environment variables in Railway dashboard.

### Vercel

Uses `vercel.json` configuration for serverless deployment.

```bash
vercel
```

Add environment variables in Vercel dashboard.

## License

Proprietary - JadeHandForward
