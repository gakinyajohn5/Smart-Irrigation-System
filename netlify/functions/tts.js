exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { text, lang } = JSON.parse(event.body || '{}');
    if (!text) return { statusCode: 400, body: JSON.stringify({ error: 'No text' }) };

    const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim();
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set in Netlify');

    // Sarah: a premade voice that free plans can use. Override in Netlify if you like.
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
    const modelId = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: String(text).slice(0, 1000),
          model_id: modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      const hint = /API key ID/i.test(detail)
        ? ` | The saved value ${apiKey.startsWith('sk_') ? 'starts with sk_ but ElevenLabs still calls it an ID' : 'does NOT start with sk_ (it starts with "' + apiKey.slice(0, 3) + '…", length ' + apiKey.length + ')'}. Paste the secret key that starts with sk_, save, then redeploy.`
        : '';
      throw new Error(`ElevenLabs ${response.status}: ${detail.slice(0, 200)}${hint}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: Buffer.from(audioBuffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('tts error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
