const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, lang, context } = JSON.parse(event.body);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const systemInstruction = `You are a helpful, practical agricultural expert assistant built into a smart irrigation app. 
    Current Farm Context: Farm Name: ${context.farm}, Crops/Zones: ${context.crops}, Weather: ${context.weather}.
    The user's preferred language is ${lang === 'sw' ? 'Swahili' : 'English'}. Keep answers concise, actionable, and tailored to farming in Kenya.`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });

    // Format chat history for Gemini SDK
    const formattedHistory = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const chat = model.startChat({ history: formattedHistory });
    const lastMessage = messages[messages.length - 1].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: response.text() })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
