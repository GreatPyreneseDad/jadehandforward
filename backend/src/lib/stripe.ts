import Stripe from 'stripe';
import { config } from 'dotenv';
import { supabase } from './supabase.js';
import { coinsForUsd } from './coins.js';

config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export async function createCoinCheckout(userId: string, tierUsd: number) {
  const coins = coinsForUsd(tierUsd);

  const intent = await stripe.paymentIntents.create({
    amount: tierUsd * 100, // cents
    currency: 'usd',
    metadata: {
      user_id: userId,
      coins: coins.toString(),
      tier_usd: tierUsd.toString(),
    },
    description: `JadeHandForward — J~ ${coins} jade coin${coins > 1 ? 's' : ''}`,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  // Store pending purchase
  await supabase.from('coin_purchases').insert({
    user_id: userId,
    stripe_payment_intent_id: intent.id,
    amount_usd: tierUsd * 100,
    coins_granted: coins,
    tier: `$${tierUsd}`,
    status: 'pending',
  });

  return intent.client_secret;
}

export async function handleStripeWebhook(rawBody: Buffer, sig: string) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { user_id, coins } = intent.metadata;

    if (!user_id || !coins) {
      console.error('Missing metadata in payment intent:', intent.id);
      return;
    }

    // Mark purchase complete
    await supabase
      .from('coin_purchases')
      .update({ status: 'complete' })
      .eq('stripe_payment_intent_id', intent.id);

    // Credit coins to ledger
    await supabase.from('coin_ledger').insert({
      user_id,
      amount: parseInt(coins),
      type: 'purchase',
      reference_id: intent.id,
      note: `Purchased via Stripe — ${intent.id}`,
    });

    console.log(`✅ Credited ${coins} J~ coins to user ${user_id}`);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;

    await supabase
      .from('coin_purchases')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', intent.id);

    console.log(`❌ Payment failed for intent ${intent.id}`);
  }
}
