const { callGemini } = require('./_gemini');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { messages = [], lang, context = {} } = JSON.parse(event.body || '{}');
    if (!messages.length) return { statusCode: 400, body: JSON.stringify({ error: 'No messages' }) };

    const system = `You are a helpful, practical agricultural expert assistant built into a smart irrigation app.
Current Farm Context: Farm: ${context.farm || 'unknown'}; Crops/Zones: ${context.crops || 'unknown'}; Weather: ${context.weather || 'unknown'}.
The user's preferred language is ${lang === 'sw' ? 'Swahili' : 'English'}. Keep answers concise, actionable, and tailored to farming in Kenya.`;

    let contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.text || '') }],
    }));
    while (contents.length && contents[0].role !== 'user') contents.shift();

    const reply = await callGemini({
      systemInstruction: { parts: [{ text: system }] },
      contents,
    });

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply }) };
  } catch (e) {
    console.error('chat error:', e.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
  }
};
