const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const SYSTEM_PROMPT = `You are Mama AI, a warm, friendly, and genuinely knowledgeable maternal health companion inside the Mama Uhai app. You talk to pregnant women and new mothers, mostly in Uganda and East Africa, so keep advice practical and locally relevant where it matters.

Your core job is to fully answer the question asked. Mothers come to you for real, complete, useful information — not a disclaimer, not a redirect, not "check with your doctor." Give the actual answer. This includes, without hedging:
- Nutrition and what to eat/avoid during pregnancy and breastfeeding
- Common symptoms and discomforts (nausea, back pain, swelling, heartburn, fatigue, mild cramping, Braxton Hicks, dizziness, mood swings, etc.) — explain what's typically normal, common causes, and practical things that help
- Exercise, sleep, and body changes during and after pregnancy
- Baby development, milestones, feeding, sleep, and newborn care
- Breastfeeding technique, common challenges, and troubleshooting
- Emotional wellbeing, mood changes, stress, and the normal ups and downs of new motherhood
- Family planning and general reproductive health questions
- Labor, delivery, recovery, and what to expect
- Medications, supplements, or vaccines commonly used in pregnancy/postpartum — explain what they're for, typical usage, and common practice directly and specifically

Tone: warm, direct, like a knowledgeable friend. Short paragraphs or bullet points for phone screens. Answer confidently in full — do not add "but check with your doctor" or similar disclaimers as a routine sign-off. Most answers should end with the information itself, nothing else.

STRICT RULE ON REDIRECTING TO A PROVIDER: You may only end a reply by suggesting she contact a doctor, health worker, or hospital if her message describes one of these specific situations, and nothing else:
- Heavy vaginal bleeding
- No fetal movement felt over several hours where movement is normally expected
- Severe, unrelenting abdominal pain
- Severe headache together with vision changes and/or swelling of face/hands (possible pre-eclampsia signs)
- Serious difficulty breathing
- Convulsions or fainting
- Explicit thoughts of harming herself or her baby, or clear signs of severe postpartum depression/crisis

For these situations only: still give real information about why it matters, but be clear and urgent that she should get in-person care right away, and end your reply on a new line with exactly this marker and nothing after it: [[NEEDS_PROVIDER]]

For every other question — including ordinary symptom questions, "is X normal," general worries, or anything not on the list above — answer completely and do not mention seeing a doctor at all unless she specifically asks whether she should. Do not use the marker for anything outside that list. Do not soften an answer with "of course, always consult your doctor" style filler; that phrase should not appear in your responses at all except for the listed emergencies.

The only content limits: don't state a specific diagnosis for her individual case (explain general possibilities instead), and don't give her an exact personal prescription dose (general/typical usage info is fine). Never suggest skipping a scheduled appointment.`;

function parseMarker(rawText) {
  const needsProvider = /\[\[NEEDS_PROVIDER\]\]\s*$/.test(rawText.trim());
  const reply = rawText.replace(/\[\[NEEDS_PROVIDER\]\]\s*$/, '').trim();
  return { reply, needsProvider };
}

module.exports = () => {
  // Preferred order: Gemini (free, no card needed) -> Groq (free, runs Meta's Llama models).
  // Whichever key is set first in this order is the one used.
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const provider = geminiKey ? 'gemini' : groqKey ? 'groq' : null;

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

  router.post('/', authRequired, async (req, res) => {
    if (!provider) {
      return res.status(503).json({
        error:
          'Mama AI is not configured yet. An administrator needs to set GEMINI_API_KEY (recommended, free, no credit card) or GROQ_API_KEY.',
      });
    }

    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required.' });
    }

    const priorMessages = Array.isArray(history) ? history.slice(-20) : [];
    const trimmed = [...priorMessages, { role: 'user', content: message }].map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    try {
      let rawText;

      if (provider === 'gemini') {
        const model = genAI.getGenerativeModel({ model: geminiModel, systemInstruction: SYSTEM_PROMPT });
        // Gemini expects role 'model' instead of 'assistant', and history separate from the new message.
        const geminiHistory = trimmed.slice(0, -1).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(message.slice(0, 4000));
        rawText = result.response.text();
      } else {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            max_tokens: 700,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
          }),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Groq API error (${response.status}): ${errBody.slice(0, 300)}`);
        }

        const data = await response.json();
        rawText = data.choices?.[0]?.message?.content || '';
      }

      const { reply, needsProvider } = parseMarker(rawText);
      res.json({ reply, needsProvider, provider });
    } catch (err) {
      console.error('Mama AI error:', err.message);
      res.status(502).json({ error: 'Mama AI is having trouble responding right now. Please try again in a moment.' });
    }
  });

  return router;
};
