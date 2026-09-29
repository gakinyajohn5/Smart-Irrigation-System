exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { image } = JSON.parse(event.body || '{}');
    if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'No image' }) };
    const prompt = `You are a crop health assistant for smallholder farmers in Kenya.
Look at this photo of a plant leaf. Identify the crop and any disease, pest damage or nutrient problem.
Reply with ONLY JSON in this exact shape:
{"crop":"","problem":"","confidence":0,"description":"","treatment":""}
- problem: the disease/pest/deficiency name, or "Healthy" if none.
- confidence: whole number 0-100. Be honest; use a low number if the photo is unclear.
- description: max 2 short sentences in simple English.
- treatment: max 2 short sentences, using products commonly available in Kenya.
If the image is not a plant, set crop to "Unknown", problem to "No plant found", confidence to 0.`;
    const model = 'gemini-2.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: 'image/jpeg', data: image } },
            { text: prompt }
          ]}],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Analysis failed' }) };
  }
};
