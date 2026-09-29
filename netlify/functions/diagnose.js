const { GoogleGenAI } = require('@google/genai');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = "Analyze this crop leaf image. Identify if it's healthy or has a disease/pest. Provide your response strictly in JSON format with these exact keys: 'crop' (string), 'problem' (string), 'confidence' (number between 0 and 100), 'description' (string), 'treatment' (string). Do not include markdown code blocks like ```json.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: image } }
      ]
    });

    let rawText = response.text.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: rawText
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
