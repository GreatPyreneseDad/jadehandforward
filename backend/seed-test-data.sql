-- Seed test data for JadeHandForward

-- Create a test auction (no hunter_id required for now)
insert into auctions (id, title, description, status, started_at, coins_minted, max_coins)
values (
  'a1111111-1111-1111-1111-111111111111',
  'Jade Cove Winter Collection 2026',
  'Natural nephrite from the Big Sur coast. Each piece hand-found during the February low tides.',
  'live',
  now(),
  850,
  1000
);

-- Create auction lots
insert into auction_lots (id, auction_id, lot_number, title, description, provenance, starting_price_coins, current_price_coins, status)
values
  (
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    1,
    'Translucent Green Nephrite',
    'Rare translucent piece with deep green color. 3.2 lbs, excellent polish potential.',
    'Found at Jade Cove, February 14, 2026 during -1.2 tide',
    25,
    25,
    'open'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    2,
    'Black Nephrite River Stone',
    'Smooth river-worn black nephrite. 1.8 lbs, perfect for carving.',
    'Willow Creek, Big Sur, February 18, 2026',
    20,
    20,
    'open'
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'a1111111-1111-1111-1111-111111111111',
    3,
    'Jade Cove Beach Cobble Set',
    'Three matched beach cobbles, mottled green and white. Combined 4.5 lbs.',
    'Jade Cove beach collection, February 20, 2026',
    30,
    30,
    'open'
  );

-- Note: This is test data. In production, you'll create auctions through admin interface
-- and bids will be placed by authenticated users through the API.
