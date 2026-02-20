import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getFullBalance } from '../lib/coins.js';

const router = Router();

// Magic link login
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.APP_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error('Magic link error:', error);
      return res.status(500).json({ error: 'Failed to send magic link' });
    }

    res.json({ message: 'Check your email for the login link' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get current user profile + coin balance
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    const balance = await getFullBalance(userId);

    res.json({
      user: req.user,
      profile,
      coin_balance: balance,
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
