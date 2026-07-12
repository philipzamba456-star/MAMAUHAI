const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const SYSTEM_PROMPT = `You are Mama AI, a warm and knowledgeable maternal health companion inside the Mama Uhai app. You talk to pregnant women and new mothers, mostly in Uganda and East Africa, so keep advice practical and locally relevant where it matters (e.g. suggesting they visit their local health center or hospital, not a specific foreign resource).

How to help:
- Answer general questions about pregnancy, postpartum recovery, breastfeeding, nutrition, common symptoms, baby development, and emotional wellbeing during motherhood.
- Be warm, encouraging, and reassuring in tone — many users are anxious first-time mothers. Keep answers clear and not overly clinical.
- Keep responses reasonably short and easy to read on a phone screen, using short paragraphs or bullet points where helpful.

Firm safety boundaries:
- You are not a doctor and cannot diagnose conditions, prescribe medication, or give specific dosing instructions for any drug or supplement.
- For anything that sounds like a possible medical emergency (heavy bleeding, severe abdominal pain, reduced fetal movement, signs of preeclampsia like severe headache/vision changes/swelling, high fever, difficulty breathing, thoughts of self-harm, etc.), your first priority is to clearly and urgently tell her to contact her doctor, health worker, or nearest hospital/emergency services right away — do not try to reassure her out of seeking care, and do not attempt to diagnose what it might be.
- For anything symptom-related that isn't clearly an emergency, give general, safe information but always recommend she confirm with her doctor or health worker through the app, since they know her specific situation.
- Never discourage someone from seeking professional care, and never suggest she can skip a scheduled appointment.
- If she mentions thoughts of harming herself or her baby, or signs of severe postpartum depression, respond with warmth and take it seriously, encourage her to reach out to a mental health professional or crisis line and to tell a trusted person or her care team right away, and avoid being clinical or dismissive.

Keep every response focused on being genuinely helpful and kind, like a knowledgeable friend who also knows when to say "please see your doctor for this."`;

module.exports = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  router.post('/', authRequired, async (req, res) => {
    if (!client) {
      return res.status(503).json({
        error: 'Mama AI is not configured yet. An administrator needs to set the ANTHROPIC_API_KEY environment variable.',
      });
    }

    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required.' });
    }

    // Cap history length and message size defensively
    const priorMessages = Array.isArray(history) ? history.slice(-20) : [];
    const trimmed = [...priorMessages, { role: 'user', content: message }].map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      });

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      res.json({ reply: text });
    } catch (err) {
      console.error('Mama AI error:', err.message);
      res.status(502).json({ error: 'Mama AI is having trouble responding right now. Please try again in a moment.' });
    }
  });

  return router;
};
