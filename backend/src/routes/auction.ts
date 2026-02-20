import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getEligibleBalance } from '../lib/coins.js';

const router = Router();

// Get currently live auction
router.get('/live', async (req, res) => {
  try {
    const { data: auction, error } = await supabase
      .from('auctions')
      .select(
        `
        *,
        auction_lots (
          *,
          bids!winning_bid_id (
            *,
            profiles (name, email)
          )
        )
      `
      )
      .eq('status', 'live')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Live auction fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch auction' });
    }

    res.json(auction);
  } catch (error) {
    console.error('Live auction error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get specific auction by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: auction, error } = await supabase
      .from('auctions')
      .select(
        `
        *,
        auction_lots (
          *,
          bids!winning_bid_id (
            *,
            profiles (name)
          )
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Auction fetch error:', error);
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json(auction);
  } catch (error) {
    console.error('Auction error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Place a bid on a lot
router.post('/:id/bid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { lot_id, amount_coins } = req.body;
    const userId = req.user!.id;

    if (!lot_id || !amount_coins || amount_coins <= 0) {
      return res.status(400).json({ error: 'Invalid bid parameters' });
    }

    // 1. Verify user has eligible coins
    const eligible = await getEligibleBalance(userId);
    if (eligible < amount_coins) {
      return res.status(400).json({
        error: 'Insufficient eligible coins',
        required: amount_coins,
        eligible,
      });
    }

    // 2. Verify auction is live
    const { data: auction } = await supabase
      .from('auctions')
      .select('status')
      .eq('id', id)
      .single();

    if (!auction || auction.status !== 'live') {
      return res.status(400).json({ error: 'Auction is not live' });
    }

    // 3. Verify lot is open
    const { data: lot } = await supabase
      .from('auction_lots')
      .select('*')
      .eq('id', lot_id)
      .eq('auction_id', id)
      .single();

    if (!lot || lot.status !== 'open') {
      return res.status(400).json({ error: 'Lot is not open for bidding' });
    }

    // 4. Verify bid is higher than current price
    const currentPrice = lot.current_price_coins || lot.starting_price_coins;
    if (amount_coins <= currentPrice) {
      return res.status(400).json({
        error: 'Bid must be higher than current price',
        current_price: currentPrice,
      });
    }

    // 5. Create bid
    const { data: newBid, error: bidError } = await supabase
      .from('bids')
      .insert({
        lot_id,
        user_id: userId,
        amount_coins,
        status: 'winning',
      })
      .select()
      .single();

    if (bidError) {
      console.error('Bid creation error:', bidError);
      return res.status(500).json({ error: 'Failed to place bid' });
    }

    // 6. Hold coins
    await supabase.from('coin_ledger').insert({
      user_id: userId,
      amount: -amount_coins,
      type: 'bid_hold',
      reference_id: newBid.id,
      note: `Hold for bid on lot ${lot_id}`,
    });

    // 7. Release previous winner's hold (if exists)
    if (lot.winning_bid_id) {
      const { data: previousBid } = await supabase
        .from('bids')
        .select('*')
        .eq('id', lot.winning_bid_id)
        .single();

      if (previousBid) {
        // Release hold
        await supabase.from('coin_ledger').insert({
          user_id: previousBid.user_id,
          amount: previousBid.amount_coins,
          type: 'bid_release',
          reference_id: previousBid.id,
          note: `Released hold - outbid on lot ${lot_id}`,
        });

        // Mark previous bid as outbid
        await supabase
          .from('bids')
          .update({ status: 'outbid' })
          .eq('id', lot.winning_bid_id);
      }
    }

    // 8. Update lot
    await supabase
      .from('auction_lots')
      .update({
        current_price_coins: amount_coins,
        winning_bid_id: newBid.id,
      })
      .eq('id', lot_id);

    res.json({
      bid_id: newBid.id,
      new_price: amount_coins,
      status: 'winning',
    });
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
