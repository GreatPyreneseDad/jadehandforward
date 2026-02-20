import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import coinRoutes from './routes/coins.js';
import hunterRoutes from './routes/hunters.js';
import agentRoutes from './routes/agent.js';
import auctionRoutes from './routes/auction.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
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

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   JadeHandForward Backend Server       ║
  ║   Natural jade only · Never quarried   ║
  ╚════════════════════════════════════════╝

  🌊 Server running on port ${PORT}
  🔗 API: http://localhost:${PORT}/api
  📊 Health: http://localhost:${PORT}/health

  Environment: ${process.env.NODE_ENV || 'development'}
  `);
});
