import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getEligibleBalance, getFullBalance } from '../lib/coins.js';

const router = Router();

const PLATFORM_FEE_RATE = 0.05; // 5% fee

// ============================================================================
// MARKETPLACE LISTINGS
// ============================================================================

// Get all active marketplace listings
router.get('/listings', async (req, res) => {
  try {
    const { type } = req.query; // 'coins' or 'jade' filter

    let query = supabase
      .from('marketplace_listings')
      .select(`
        *,
        profiles!seller_id (name, email)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (type === 'coins' || type === 'jade') {
      query = query.eq('listing_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Marketplace listings fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch listings' });
    }

    res.json(data);
  } catch (error) {
    console.error('Marketplace listings error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get user's own listings
router.get('/my-listings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('seller_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('My listings fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch listings' });
    }

    res.json(data);
  } catch (error) {
    console.error('My listings error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Create coin listing
router.post('/listings/coins', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { coins_offered, price_per_coin_usd, sale_type, expires_in_days } =
      req.body;
    const userId = req.user!.id;

    if (!coins_offered || !price_per_coin_usd || !sale_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (coins_offered <= 0) {
      return res.status(400).json({ error: 'Invalid coin amount' });
    }

    // Verify user has coins to sell
    const balance = await getFullBalance(userId);
    if (balance.total < coins_offered) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: coins_offered,
        available: balance.total,
      });
    }

    // Calculate expiration
    const expires_at = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({
        seller_id: userId,
        listing_type: 'coins',
        coins_offered,
        price_per_coin_usd,
        sale_type,
        expires_at,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Coin listing creation error:', error);
      return res.status(500).json({ error: 'Failed to create listing' });
    }

    res.json(data);
  } catch (error) {
    console.error('Coin listing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Create jade listing
router.post('/listings/jade', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      jade_title,
      jade_description,
      jade_images,
      jade_provenance,
      jade_price_coins,
      jade_price_usd,
      sale_type,
      expires_in_days,
    } = req.body;
    const userId = req.user!.id;

    if (!jade_title || !sale_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!jade_price_coins && !jade_price_usd) {
      return res
        .status(400)
        .json({ error: 'Must specify price in coins or USD' });
    }

    const expires_at = expires_in_days
      ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
      : null;

    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({
        seller_id: userId,
        listing_type: 'jade',
        jade_title,
        jade_description,
        jade_images: jade_images || [],
        jade_provenance,
        jade_price_coins,
        jade_price_usd,
        sale_type,
        expires_at,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Jade listing creation error:', error);
      return res.status(500).json({ error: 'Failed to create listing' });
    }

    res.json(data);
  } catch (error) {
    console.error('Jade listing error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Cancel listing
router.delete('/listings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const { data: listing } = await supabase
      .from('marketplace_listings')
      .select('seller_id, status')
      .eq('id', id)
      .single();

    if (!listing || listing.seller_id !== userId) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing not active' });
    }

    const { error } = await supabase
      .from('marketplace_listings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      console.error('Listing cancellation error:', error);
      return res.status(500).json({ error: 'Failed to cancel listing' });
    }

    res.json({ message: 'Listing cancelled' });
  } catch (error) {
    console.error('Listing cancellation error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ============================================================================
// MARKETPLACE PURCHASES
// ============================================================================

// Purchase from marketplace
router.post('/buy/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 1. Get listing
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing not available' });
    }

    if (listing.seller_id === userId) {
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }

    // 2. Process based on listing type
    if (listing.listing_type === 'coins') {
      return await processCoinPurchase(listing, userId, res);
    } else if (listing.listing_type === 'jade') {
      return await processJadePurchase(listing, userId, res);
    }

    return res.status(400).json({ error: 'Invalid listing type' });
  } catch (error) {
    console.error('Marketplace purchase error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Helper: Process coin-to-coin purchase
async function processCoinPurchase(listing: any, buyerId: string, res: any) {
  const coinsOffered = listing.coins_offered;
  const pricePerCoin = parseFloat(listing.price_per_coin_usd);
  const totalUsd = coinsOffered * pricePerCoin;
  const platformFeeUsd = totalUsd * PLATFORM_FEE_RATE;
  const sellerReceivesUsd = totalUsd - platformFeeUsd;

  // Verify buyer has eligible coins
  const eligibleBalance = await getEligibleBalance(buyerId);
  if (eligibleBalance < coinsOffered) {
    return res.status(400).json({
      error: 'Insufficient eligible coins',
      required: coinsOffered,
      eligible: eligibleBalance,
    });
  }

  // Create transaction record
  const { data: transaction, error: txError } = await supabase
    .from('marketplace_transactions')
    .insert({
      listing_id: listing.id,
      seller_id: listing.seller_id,
      buyer_id: buyerId,
      listing_type: 'coins',
      coins_transacted: coinsOffered,
      usd_amount_cents: Math.round(totalUsd * 100),
      platform_fee_usd_cents: Math.round(platformFeeUsd * 100),
      seller_receives_usd_cents: Math.round(sellerReceivesUsd * 100),
      payout_status: 'pending',
    })
    .select()
    .single();

  if (txError) {
    console.error('Transaction creation error:', txError);
    return res.status(500).json({ error: 'Transaction failed' });
  }

  // Update coin ledger
  // Buyer: debit coins
  await supabase.from('coin_ledger').insert({
    user_id: buyerId,
    amount: -coinsOffered,
    type: 'marketplace_buy',
    reference_id: transaction.id,
    note: `Purchased ${coinsOffered} coins on marketplace`,
  });

  // Seller: credit coins (after 5% fee deduction in USD at payout)
  await supabase.from('coin_ledger').insert({
    user_id: listing.seller_id,
    amount: coinsOffered,
    type: 'marketplace_sell',
    reference_id: transaction.id,
    note: `Sold ${coinsOffered} coins on marketplace`,
  });

  // Mark listing as sold
  await supabase
    .from('marketplace_listings')
    .update({ status: 'sold', sold_at: new Date().toISOString() })
    .eq('id', listing.id);

  return res.json({
    transaction_id: transaction.id,
    coins_purchased: coinsOffered,
    total_usd: totalUsd,
    message: 'Purchase complete',
  });
}

// Helper: Process jade purchase with coins
async function processJadePurchase(listing: any, buyerId: string, res: any) {
  const priceCoins = listing.jade_price_coins;
  const priceUsd = listing.jade_price_usd;

  if (priceCoins) {
    // Payment in coins
    const eligibleBalance = await getEligibleBalance(buyerId);
    if (eligibleBalance < priceCoins) {
      return res.status(400).json({
        error: 'Insufficient eligible coins',
        required: priceCoins,
        eligible: eligibleBalance,
      });
    }

    // 5% fee in coins (rounded)
    const platformFeeCoins = Math.round(priceCoins * PLATFORM_FEE_RATE);
    const sellerReceivesCoins = priceCoins - platformFeeCoins;

    // Create transaction
    const { data: transaction, error: txError } = await supabase
      .from('marketplace_transactions')
      .insert({
        listing_id: listing.id,
        seller_id: listing.seller_id,
        buyer_id: buyerId,
        listing_type: 'jade',
        coins_transacted: priceCoins,
        seller_receives_coins: sellerReceivesCoins,
        payout_status: 'complete',
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      return res.status(500).json({ error: 'Transaction failed' });
    }

    // Update ledger
    await supabase.from('coin_ledger').insert([
      {
        user_id: buyerId,
        amount: -priceCoins,
        type: 'marketplace_buy',
        reference_id: transaction.id,
        note: `Purchased jade: ${listing.jade_title}`,
      },
      {
        user_id: listing.seller_id,
        amount: sellerReceivesCoins,
        type: 'marketplace_sell',
        reference_id: transaction.id,
        note: `Sold jade: ${listing.jade_title}`,
      },
      {
        user_id: listing.seller_id,
        amount: -platformFeeCoins,
        type: 'marketplace_fee',
        reference_id: transaction.id,
        note: `Platform fee (5%)`,
      },
    ]);

    // Mark listing sold
    await supabase
      .from('marketplace_listings')
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .eq('id', listing.id);

    return res.json({
      transaction_id: transaction.id,
      jade_title: listing.jade_title,
      price_coins: priceCoins,
      message: 'Jade purchased successfully',
    });
  } else if (priceUsd) {
    // Payment in USD via Stripe - would need Stripe integration
    return res.status(501).json({
      error: 'USD payments not yet implemented',
      message: 'Contact support for USD jade purchases',
    });
  }

  return res.status(400).json({ error: 'No valid price set' });
}

// ============================================================================
// REDEMPTIONS
// ============================================================================

// Request coin redemption (seller cashes out at $20/coin)
router.post('/redeem', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { coins } = req.body;
    const userId = req.user!.id;

    if (!coins || coins <= 0) {
      return res.status(400).json({ error: 'Invalid coin amount' });
    }

    // Verify user has coins
    const balance = await getFullBalance(userId);
    if (balance.total < coins) {
      return res.status(400).json({
        error: 'Insufficient coins',
        required: coins,
        available: balance.total,
      });
    }

    // Calculate payout at $20/coin
    const payoutCents = coins * 2000; // $20 = 2000 cents

    // Create redemption request
    const { data, error } = await supabase
      .from('redemption_requests')
      .insert({
        user_id: userId,
        coins_redeemed: coins,
        usd_payout_cents: payoutCents,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Redemption creation error:', error);
      return res.status(500).json({ error: 'Failed to create redemption' });
    }

    // Hold coins immediately
    await supabase.from('coin_ledger').insert({
      user_id: userId,
      amount: -coins,
      type: 'redemption',
      reference_id: data.id,
      note: `Redemption request — ${coins} coins at $20/coin`,
    });

    res.json({
      redemption_id: data.id,
      coins_redeemed: coins,
      usd_payout: payoutCents / 100,
      status: 'pending',
      message: 'Redemption request submitted for approval',
    });
  } catch (error) {
    console.error('Redemption error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get user's redemption requests
router.get('/redemptions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('redemption_requests')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Redemptions fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch redemptions' });
    }

    res.json(data);
  } catch (error) {
    console.error('Redemptions error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
