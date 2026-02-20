// Vercel serverless function - wraps Express app
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Import routes
import authRoutes from '../backend/src/routes/auth.js';
import coinRoutes from '../backend/src/routes/coins.js';
import hunterRoutes from '../backend/src/routes/hunters.js';
import agentRoutes from '../backend/src/routes/agent.js';
import auctionRoutes from '../backend/src/routes/auction.js';
import marketplaceRoutes from '../backend/src/routes/marketplace.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.APP_URL || 'https://jadehand.com',
  credentials: true,
}));

// Raw body for Stripe webhooks
app.use('/api/coins/webhook', express.raw({ type: 'application/json' }));

// JSON body for everything else
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/hunters', hunterRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
