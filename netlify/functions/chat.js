const { GoogleGenAI } = require('@google/genai');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, lang, context } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are a helpful, practical agricultural expert assistant built into a smart irrigation app. 
    Current Farm Context: Farm Name: ${context.farm}, Crops/Zones: ${context.crops}, Weather: ${context.weather}, Location Coords: ${context.lat}, ${context.lon}.
    The user's preferred language is ${lang === 'sw' ? 'Swahili' : 'English'}. Keep answers concise, actionable, and tailored to farming in Kenya.`;

    const chatHistory = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction },
      history: chatHistory.slice(0, -1)
    });

    const lastMessage = messages[messages.length - 1].text;
    const result = await chat.sendMessage({ message: lastMessage });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: result.text })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
