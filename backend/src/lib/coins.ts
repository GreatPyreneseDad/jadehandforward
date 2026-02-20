import { supabase } from './supabase.js';

export const COIN_TIERS = [
  { usd: 25, coins: 1, label: '$25 — J~ 1 coin' },
  { usd: 50, coins: 2, label: '$50 — J~ 2 coins' },
  { usd: 100, coins: 4, label: '$100 — J~ 4 coins' },
  { usd: 250, coins: 10, label: '$250 — J~ 10 coins' },
  { usd: 500, coins: 20, label: '$500 — J~ 20 coins' },
  { usd: 1000, coins: 40, label: '$1000 — J~ 40 coins' },
] as const;

export function coinsForUsd(usd: number): number {
  const tier = COIN_TIERS.find((t) => t.usd === usd);
  if (!tier) throw new Error(`No tier for $${usd}`);
  return tier.coins;
}

// Check if user's coins are eligible to bid (held > 24hrs)
export async function getEligibleBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('eligible_coins')
    .select('eligible_balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching eligible balance:', error);
    return 0;
  }

  return data?.eligible_balance ?? 0;
}

// Get total balance (including coins not yet eligible)
export async function getTotalBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('coin_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching total balance:', error);
    return 0;
  }

  return data?.balance ?? 0;
}

// Get pending coins (purchased < 24 hours ago)
export async function getPendingBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('coin_ledger')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error fetching pending balance:', error);
    return 0;
  }

  return data?.reduce((sum, row) => sum + row.amount, 0) ?? 0;
}

export interface CoinBalance {
  total: number;
  eligible: number;
  pending_24hr: number;
}

export async function getFullBalance(userId: string): Promise<CoinBalance> {
  const [total, eligible, pending_24hr] = await Promise.all([
    getTotalBalance(userId),
    getEligibleBalance(userId),
    getPendingBalance(userId),
  ]);

  return { total, eligible, pending_24hr };
}
