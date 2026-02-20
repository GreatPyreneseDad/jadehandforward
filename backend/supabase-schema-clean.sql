-- JadeHandForward Database Schema
-- Run this in Supabase SQL Editor

-- PROFILES
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  phone text,
  location text,
  role text default 'buyer' check (role in ('buyer', 'hunter', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- COIN LEDGER
create table coin_ledger (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  amount integer not null,
  type text not null check (type in (
    'purchase',
    'bid_hold',
    'bid_release',
    'bid_won',
    'seller_credit',
    'redemption',
    'marketplace_buy',
    'marketplace_sell',
    'marketplace_fee'
  )),
  reference_id text,
  note text,
  created_at timestamptz default now()
);

-- View: current balance per user
create view coin_balances as
  select user_id, sum(amount) as balance
  from coin_ledger
  group by user_id;

-- View: coins eligible to bid (held > 24 hours)
create view eligible_coins as
  select
    user_id,
    sum(amount) as eligible_balance,
    min(created_at) as oldest_purchase
  from coin_ledger
  where type = 'purchase'
    and created_at < now() - interval '24 hours'
  group by user_id;

-- COIN PURCHASES
create table coin_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  stripe_payment_intent_id text unique,
  amount_usd integer not null,
  coins_granted integer not null,
  tier text not null,
  status text default 'pending' check (status in ('pending','complete','failed')),
  created_at timestamptz default now()
);

-- HUNTER REGISTRATIONS
create table hunter_registrations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  location text,
  hunting_grounds text,
  experience text,
  stone_types text[],
  volume text,
  best_find text,
  needs text,
  commission_open boolean default false,
  commission_territory text,
  commission_rate text,
  notes text,
  status text default 'pending' check (status in ('pending','contacted','approved','declined')),
  created_at timestamptz default now()
);

-- AUCTIONS
create table auctions (
  id uuid default gen_random_uuid() primary key,
  hunter_id uuid references profiles(id),
  title text not null,
  description text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  coins_minted integer default 0,
  max_coins integer default 1000,
  status text default 'scheduled' check (status in (
    'scheduled', 'live', 'ended', 'cancelled'
  )),
  created_at timestamptz default now()
);

create table auction_lots (
  id uuid default gen_random_uuid() primary key,
  auction_id uuid references auctions(id),
  lot_number integer not null,
  title text,
  description text,
  provenance text,
  starting_price_coins integer not null,
  current_price_coins integer,
  winning_bid_id uuid,
  status text default 'pending' check (status in (
    'pending', 'open', 'sold', 'passed'
  )),
  created_at timestamptz default now()
);

create table bids (
  id uuid default gen_random_uuid() primary key,
  lot_id uuid references auction_lots(id),
  user_id uuid references profiles(id),
  amount_coins integer not null,
  status text default 'active' check (status in (
    'active', 'winning', 'outbid', 'won', 'cancelled'
  )),
  created_at timestamptz default now()
);

-- PRIVATE HUNT COMMISSIONS
create table hunt_commissions (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references profiles(id),
  hunter_id uuid references profiles(id),
  intention text not null,
  spiritual_intention text,
  budget_usd integer,
  status text default 'requested' check (status in (
    'requested', 'matched', 'accepted', 'in_field', 'complete', 'cancelled'
  )),
  stripe_payment_intent_id text,
  field_notes text,
  created_at timestamptz default now()
);

-- MARKETPLACE
create table marketplace_listings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references profiles(id) on delete cascade,
  listing_type text not null check (listing_type in ('coins', 'jade')),
  coins_offered integer,
  price_per_coin_usd numeric(10,2),
  jade_title text,
  jade_description text,
  jade_images text[],
  jade_provenance text,
  jade_price_coins integer,
  jade_price_usd integer,
  sale_type text not null check (sale_type in ('fixed', 'offer')),
  status text default 'active' check (status in (
    'active', 'sold', 'cancelled', 'expired'
  )),
  created_at timestamptz default now(),
  sold_at timestamptz,
  expires_at timestamptz
);

create table marketplace_transactions (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references marketplace_listings(id),
  seller_id uuid references profiles(id),
  buyer_id uuid references profiles(id),
  listing_type text not null,
  coins_transacted integer,
  usd_amount_cents integer,
  platform_fee_usd_cents integer,
  seller_receives_coins integer,
  seller_receives_usd_cents integer,
  payout_status text default 'pending' check (payout_status in (
    'pending', 'processing', 'complete', 'failed'
  )),
  stripe_transfer_id text,
  created_at timestamptz default now()
);

create table redemption_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  coins_redeemed integer not null,
  usd_payout_cents integer not null,
  status text default 'pending' check (status in (
    'pending', 'approved', 'processing', 'complete', 'rejected'
  )),
  stripe_payout_id text,
  rejection_reason text,
  requested_at timestamptz default now(),
  completed_at timestamptz
);

-- ROW LEVEL SECURITY (RLS)
alter table profiles enable row level security;
create policy "Own profile" on profiles
  for all using (auth.uid() = id);

alter table coin_ledger enable row level security;
create policy "Own coins" on coin_ledger
  for select using (auth.uid() = user_id);

alter table coin_purchases enable row level security;
create policy "Own purchases" on coin_purchases
  for select using (auth.uid() = user_id);

alter table hunter_registrations enable row level security;
create policy "Anyone can register" on hunter_registrations
  for insert with check (true);
create policy "Own registration" on hunter_registrations
  for select using (email = auth.jwt() ->> 'email' or email = (select email from profiles where id = auth.uid()));

alter table auctions enable row level security;
create policy "Public read auctions" on auctions
  for select using (true);

alter table auction_lots enable row level security;
create policy "Public read lots" on auction_lots
  for select using (true);

alter table bids enable row level security;
create policy "Own bids" on bids
  for select using (auth.uid() = user_id);
create policy "Winning bids public" on bids
  for select using (status = 'winning' or status = 'won');

alter table hunt_commissions enable row level security;
create policy "Own commissions" on hunt_commissions
  for select using (auth.uid() = buyer_id or auth.uid() = hunter_id);

alter table marketplace_listings enable row level security;
create policy "Public read marketplace" on marketplace_listings
  for select using (status = 'active');
create policy "Sellers manage own listings" on marketplace_listings
  for all using (auth.uid() = seller_id);

alter table marketplace_transactions enable row level security;
create policy "Own transactions" on marketplace_transactions
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

alter table redemption_requests enable row level security;
create policy "Own redemptions" on redemption_requests
  for all using (auth.uid() = user_id);

-- INDEXES
create index idx_coin_ledger_user_id on coin_ledger(user_id);
create index idx_coin_ledger_created_at on coin_ledger(created_at);
create index idx_coin_purchases_user_id on coin_purchases(user_id);
create index idx_bids_lot_id on bids(lot_id);
create index idx_bids_user_id on bids(user_id);
create index idx_auction_lots_auction_id on auction_lots(auction_id);
create index idx_marketplace_listings_seller_id on marketplace_listings(seller_id);
create index idx_marketplace_listings_status on marketplace_listings(status);
create index idx_marketplace_transactions_buyer_id on marketplace_transactions(buyer_id);
create index idx_marketplace_transactions_seller_id on marketplace_transactions(seller_id);
create index idx_redemption_requests_user_id on redemption_requests(user_id);
create index idx_redemption_requests_status on redemption_requests(status);
