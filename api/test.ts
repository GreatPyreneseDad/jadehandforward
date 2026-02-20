// Minimal test function - no imports, no dependencies
export default function handler(req: any, res: any) {
  return res.status(200).json({
    status: 'ok',
    message: 'Minimal function works!',
    env_check: {
      has_supabase_url: !!process.env.SUPABASE_URL,
      has_supabase_key: !!process.env.SUPABASE_ANON_KEY,
      has_stripe: !!process.env.STRIPE_SECRET_KEY,
      has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    }
  });
}
