const express = require('express');
const { authRequired } = require('../middleware/auth');
const KB = require('../data/mama-ai-kb');

const router = express.Router();

// --- Cloud provider (optional, used only if an API key is configured) -----
// Kept from the original implementation so an administrator can still
// upgrade Mama AI to a full conversational model later just by setting
// GEMINI_API_KEY or GROQ_API_KEY in the environment. It is no longer the
// primary path: the offline knowledge base below always works, with no
// internet connection and no API key required.
let GoogleGenerativeAI;
try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch {
  GoogleGenerativeAI = null;
}

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

// --- Offline knowledge base search -----------------------------------------
const STOPWORDS = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'i', 'my', 'me', 'you', 'your', 'do', 'does', 'did',
  'to', 'of', 'in', 'on', 'for', 'and', 'or', 'it', 'this', 'that', 'what', 'why', 'how', 'when', 'can', 'should',
  'will', 'with', 'about', 'have', 'has', 'be', 'am', 'im', "i'm", 'if', 'so', 'at', 'as']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function scoreEntry(entry, queryTokens, queryLower) {
  let score = 0;
  for (const kw of entry.keywords) {
    if (queryLower.includes(kw)) {
      // Multi-word keyword phrase matches are a strong signal.
      score += kw.includes(' ') ? 3 : 1;
    }
  }
  const entryTokenSet = new Set(tokenize(entry.keywords.join(' ') + ' ' + entry.question));
  for (const t of queryTokens) {
    if (entryTokenSet.has(t)) score += 0.5;
  }
  return score;
}

function searchKnowledgeBase(message) {
  const queryLower = String(message || '').toLowerCase();
  const queryTokens = tokenize(message);

  let best = null;
  let bestScore = 0;
  for (const entry of KB) {
    const score = scoreEntry(entry, queryTokens, queryLower);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  // Require a reasonably confident match before answering from the KB.
  if (best && bestScore >= 1) {
    return best;
  }
  return null;
}

const EMERGENCY_FALLBACK_KEYWORDS = [
  'heavy bleeding', 'severe bleeding', 'no movement', 'not moving', 'severe headache',
  'cant breathe', "can't breathe", 'difficulty breathing', 'convulsion', 'seizure',
  'fainted', 'unconscious', 'severe pain', 'harm myself', 'harm my baby', 'suicidal',
];

function offlineAnswer(message) {
  const match = searchKnowledgeBase(message);
  const lower = String(message || '').toLowerCase();
  const emergencyDetected = (match && match.emergency) || EMERGENCY_FALLBACK_KEYWORDS.some((kw) => lower.includes(kw));

  if (match) {
    return { reply: match.answer, needsProvider: !!match.emergency || emergencyDetected };
  }

  if (emergencyDetected) {
    return {
      reply: "This sounds like it could be serious. Please get in-person medical care right away — go to your nearest hospital or health facility, or contact your doctor or health worker immediately.",
      needsProvider: true,
    };
  }

  return {
    reply: "I don't have a confident answer for that in my current knowledge base. For anything specific to your situation, it's best to contact your doctor or health worker directly — they can give you guidance based on your full history. You're welcome to ask me about pregnancy, nutrition, medications, antenatal care, danger signs, breastfeeding, newborn care, family planning, vaccinations, or postpartum recovery in the meantime.",
    needsProvider: false,
  };
}

module.exports = () => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const cloudProvider = geminiKey && GoogleGenerativeAI ? 'gemini' : groqKey ? 'groq' : null;

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const genAI = geminiKey && GoogleGenerativeAI ? new GoogleGenerativeAI(geminiKey) : null;

  async function askCloud(message, history) {
    const priorMessages = Array.isArray(history) ? history.slice(-20) : [];
    const trimmed = [...priorMessages, { role: 'user', content: message }].map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    let rawText;
    if (cloudProvider === 'gemini') {
      const model = genAI.getGenerativeModel({ model: geminiModel, systemInstruction: SYSTEM_PROMPT });
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
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

    return parseMarker(rawText);
  }

  router.post('/', authRequired, async (req, res) => {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required.' });
    }

    // Cloud model first, if configured — it's more capable and conversational.
    // Falls straight through to the offline knowledge base on any error, so
    // Mama AI always responds instead of showing an error to the mother.
    if (cloudProvider) {
      try {
        const { reply, needsProvider } = await askCloud(message, history);
        return res.json({ reply, needsProvider, provider: cloudProvider });
      } catch (err) {
        console.error('Mama AI cloud provider error, falling back to offline knowledge base:', err.message);
      }
    }

    const { reply, needsProvider } = offlineAnswer(message);
    res.json({ reply, needsProvider, provider: 'offline-kb' });
  });

  return router;
};
