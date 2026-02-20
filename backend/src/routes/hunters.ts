import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

// Public hunter registration
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      location,
      hunting_grounds,
      experience,
      stone_types,
      volume,
      best_find,
      needs,
      commission_open,
      commission_territory,
      commission_rate,
      notes,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    const { data, error } = await supabase
      .from('hunter_registrations')
      .insert({
        name,
        email,
        phone,
        location,
        hunting_grounds,
        experience,
        stone_types,
        volume,
        best_find,
        needs,
        commission_open,
        commission_territory,
        commission_rate,
        notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Hunter registration error:', error);
      return res.status(500).json({ error: 'Failed to register' });
    }

    res.json({
      id: data.id,
      message: "We'll be in touch soon. Bring your jade.",
    });
  } catch (error) {
    console.error('Hunter registration error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
