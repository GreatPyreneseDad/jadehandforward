import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { createCoinCheckout, handleStripeWebhook } from '../lib/stripe.js';
import { getFullBalance, COIN_TIERS } from '../lib/coins.js';

const router = Router();

// Create Stripe payment intent for coin purchase
router.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { tier_usd } = req.body;

    if (!tier_usd || !COIN_TIERS.some((t) => t.usd === tier_usd)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const clientSecret = await createCoinCheckout(req.user!.id, tier_usd);

    res.json({ client_secret: clientSecret });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

// Stripe webhook endpoint
router.post(
  '/webhook',
  // Raw body needed for Stripe signature verification
  async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig) {
        return res.status(400).json({ error: 'Missing signature' });
      }

      await handleStripeWebhook(req.body, sig as string);

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get coin balance for current user
router.get('/balance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const balance = await getFullBalance(req.user!.id);
    res.json(balance);
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;
