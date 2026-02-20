import { Router } from 'express';
import { chatWithAgent } from '../lib/anthropic.js';

const router = Router();

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

router.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const validHistory: Message[] = Array.isArray(history)
      ? history.filter(
          (msg: any) =>
            msg &&
            typeof msg.role === 'string' &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            typeof msg.content === 'string'
        )
      : [];

    const response = await chatWithAgent(message, validHistory);

    res.json({ response });
  } catch (error: any) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message || 'Internal error' });
  }
});

export default router;
