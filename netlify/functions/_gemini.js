const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-3.6-flash',
].filter(Boolean);

async function callGemini(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set in Netlify environment variables');

  let lastErr = 'No model available';
  for (const model of MODELS) {
    const payload = { ...body };
    if (model.includes('2.5-flash')) {
      payload.generationConfig = { ...(body.generationConfig || {}), thinkingConfig: { thinkingBudget: 0 } };
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      if (text) return text;
      lastErr = `${model}: empty response`;
      continue;
    }
    lastErr = `${model}: ${res.status} ${data?.error?.message || ''}`;
    if (![404, 429, 503].includes(res.status)) throw new Error(lastErr);
  }
  throw new Error(lastErr);
}

module.exports = { callGemini };
