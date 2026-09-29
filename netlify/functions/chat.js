From 5a175f9bc18f1407c08a4160e8f4753a06dfcd48 Mon Sep 17 00:00:00 2001
From: Claude <noreply@anthropic.com>
Date: Tue, 29 Sep 2026 19:00:37 +0000
Subject: [PATCH] Fix Gemini functions: replace retired gemini-1.5-flash, add
 model fallback, fix chat history

---
 diagnose.js                   | 37 -------------------------
 netlify.toml                  |  6 ++++
 netlify/functions/_gemini.js  | 41 +++++++++++++++++++++++++++
 netlify/functions/chat.js     | 50 ++++++++++++++-------------------
 netlify/functions/diagnose.js | 52 ++++++++++++++++-------------------
 package.json                  |  4 +--
 6 files changed, 91 insertions(+), 99 deletions(-)
 delete mode 100644 diagnose.js
 create mode 100644 netlify.toml
 create mode 100644 netlify/functions/_gemini.js

diff --git a/diagnose.js b/diagnose.js
deleted file mode 100644
index b042045..0000000
--- a/diagnose.js
+++ /dev/null
@@ -1,37 +0,0 @@
-exports.handler = async (event) => {
-  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
-  try {
-    const { image } = JSON.parse(event.body || '{}');
-    if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'No image' }) };
-    const prompt = `You are a crop health assistant for smallholder farmers in Kenya.
-Look at this photo of a plant leaf. Identify the crop and any disease, pest damage or nutrient problem.
-Reply with ONLY JSON in this exact shape:
-{"crop":"","problem":"","confidence":0,"description":"","treatment":""}
-- problem: the disease/pest/deficiency name, or "Healthy" if none.
-- confidence: whole number 0-100. Be honest; use a low number if the photo is unclear.
-- description: max 2 short sentences in simple English.
-- treatment: max 2 short sentences, using products commonly available in Kenya.
-If the image is not a plant, set crop to "Unknown", problem to "No plant found", confidence to 0.`;
-    const model = 'gemini-2.5-flash';
-    const res = await fetch(
-      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
-      {
-        method: 'POST',
-        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
-        body: JSON.stringify({
-          contents: [{ parts: [
-            { inline_data: { mime_type: 'image/jpeg', data: image } },
-            { text: prompt }
-          ]}],
-          generationConfig: { responseMimeType: 'application/json' }
-        })
-      }
-    );
-    const data = await res.json();
-    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
-    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
-    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
-  } catch (e) {
-    return { statusCode: 500, body: JSON.stringify({ error: 'Analysis failed' }) };
-  }
-};
diff --git a/netlify.toml b/netlify.toml
new file mode 100644
index 0000000..36c768d
--- /dev/null
+++ b/netlify.toml
@@ -0,0 +1,6 @@
+[build]
+  publish = "."
+  functions = "netlify/functions"
+
+[functions]
+  node_bundler = "esbuild"
diff --git a/netlify/functions/_gemini.js b/netlify/functions/_gemini.js
new file mode 100644
index 0000000..57199e6
--- /dev/null
+++ b/netlify/functions/_gemini.js
@@ -0,0 +1,41 @@
+// Shared Gemini helper (plain REST, no SDK needed).
+// Tries models in order and moves on if one has been retired (404).
+const MODELS = [
+  process.env.GEMINI_MODEL,      // optional override in Netlify env vars
+  'gemini-2.5-flash',            // works now, retires ~16 Oct 2026
+  'gemini-3.6-flash',            // newer replacement
+].filter(Boolean);
+
+async function callGemini(body) {
+  const key = process.env.GEMINI_API_KEY;
+  if (!key) throw new Error('GEMINI_API_KEY is not set in Netlify environment variables');
+
+  let lastErr = 'No model available';
+  for (const model of MODELS) {
+    const payload = { ...body };
+    if (model.includes('2.5-flash')) {
+      // Skip "thinking" so replies come back well inside Netlify's 10s limit
+      payload.generationConfig = { ...(body.generationConfig || {}), thinkingConfig: { thinkingBudget: 0 } };
+    }
+    const res = await fetch(
+      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
+      {
+        method: 'POST',
+        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
+        body: JSON.stringify(payload),
+      }
+    );
+    const data = await res.json().catch(() => ({}));
+    if (res.ok) {
+      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
+      if (text) return text;
+      lastErr = `${model}: empty response (${data?.promptFeedback?.blockReason || 'no text'})`;
+      continue;
+    }
+    lastErr = `${model}: ${res.status} ${data?.error?.message || ''}`;
+    if (res.status !== 404) throw new Error(lastErr); // bad key / quota etc. – don't keep trying
+  }
+  throw new Error(lastErr);
+}
+
+module.exports = { callGemini };
diff --git a/netlify/functions/chat.js b/netlify/functions/chat.js
index bbc56ef..0529c0c 100644
--- a/netlify/functions/chat.js
+++ b/netlify/functions/chat.js
@@ -1,40 +1,30 @@
-const { GoogleGenerativeAI } = require('@google/generative-ai');
-
-exports.handler = async function(event) {
-  if (event.httpMethod !== 'POST') {
-    return { statusCode: 405, body: 'Method Not Allowed' };
-  }
+const { callGemini } = require('./_gemini');
 
+exports.handler = async function (event) {
+  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
   try {
-    const { messages, lang, context } = JSON.parse(event.body);
-    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
-    
-    const systemInstruction = `You are a helpful, practical agricultural expert assistant built into a smart irrigation app. 
-    Current Farm Context: Farm Name: ${context.farm}, Crops/Zones: ${context.crops}, Weather: ${context.weather}.
-    The user's preferred language is ${lang === 'sw' ? 'Swahili' : 'English'}. Keep answers concise, actionable, and tailored to farming in Kenya.`;
+    const { messages = [], lang, context = {} } = JSON.parse(event.body || '{}');
+    if (!messages.length) return { statusCode: 400, body: JSON.stringify({ error: 'No messages' }) };
 
-    const model = genAI.getGenerativeModel({ 
-      model: 'gemini-1.5-flash',
-      systemInstruction: systemInstruction
-    });
+    const system = `You are a helpful, practical agricultural expert assistant built into a smart irrigation app.
+Current Farm Context: Farm: ${context.farm || 'unknown'}; Crops/Zones: ${context.crops || 'unknown'}; Weather: ${context.weather || 'unknown'}.
+The user's preferred language is ${lang === 'sw' ? 'Swahili' : 'English'}. Keep answers concise, actionable, and tailored to farming in Kenya.`;
 
-    // Format chat history for Gemini SDK
-    const formattedHistory = messages.slice(0, -1).map(m => ({
+    // Gemini requires history to start with a "user" turn
+    let contents = messages.map(m => ({
       role: m.role === 'user' ? 'user' : 'model',
-      parts: [{ text: m.text }]
+      parts: [{ text: String(m.text || '') }],
     }));
+    while (contents.length && contents[0].role !== 'user') contents.shift();
 
-    const chat = model.startChat({ history: formattedHistory });
-    const lastMessage = messages[messages.length - 1].text;
-    const result = await chat.sendMessage(lastMessage);
-    const response = await result.response;
+    const reply = await callGemini({
+      systemInstruction: { parts: [{ text: system }] },
+      contents,
+    });
 
-    return {
-      statusCode: 200,
-      headers: { 'Content-Type': 'application/json' },
-      body: JSON.stringify({ reply: response.text() })
-    };
-  } catch (error) {
-    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
+    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply }) };
+  } catch (e) {
+    console.error('chat error:', e.message);
+    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
   }
 };
diff --git a/netlify/functions/diagnose.js b/netlify/functions/diagnose.js
index b5b9197..bf7f2c3 100644
--- a/netlify/functions/diagnose.js
+++ b/netlify/functions/diagnose.js
@@ -1,36 +1,30 @@
-const { GoogleGenerativeAI } = require('@google/generative-ai');
-
-exports.handler = async function(event) {
-  if (event.httpMethod !== 'POST') {
-    return { statusCode: 405, body: 'Method Not Allowed' };
-  }
+const { callGemini } = require('./_gemini');
 
+exports.handler = async function (event) {
+  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
   try {
-    const { image } = JSON.parse(event.body);
-    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
-    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
-
-    const prompt = "Analyze this crop leaf image. Identify if it's healthy or has a disease/pest. Provide your response strictly in JSON format with these exact keys: 'crop' (string), 'problem' (string), 'confidence' (number between 0 and 100), 'description' (string), 'treatment' (string). Do not include markdown code blocks.";
+    const { image } = JSON.parse(event.body || '{}');
+    if (!image) return { statusCode: 400, body: JSON.stringify({ error: 'No image' }) };
 
-    const imagePart = {
-      inlineData: {
-        data: image,
-        mimeType: 'image/jpeg'
-      }
-    };
+    const prompt = `You are a crop health assistant for smallholder farmers in Kenya.
+Look at this photo of a plant leaf. Identify the crop and any disease, pest damage or nutrient problem.
+Reply with ONLY JSON in this exact shape:
+{"crop":"","problem":"","confidence":0,"description":"","treatment":""}
+- problem: the disease/pest/deficiency name, or "Healthy" if none.
+- confidence: whole number 0-100. Be honest; use a low number if the photo is unclear.
+- description: max 2 short sentences in simple English.
+- treatment: max 2 short sentences, using products commonly available in Kenya.
+If the image is not a plant, set crop to "Unknown", problem to "No plant found", confidence to 0.`;
 
-    const result = await model.generateContent([prompt, imagePart]);
-    let rawText = result.response.text().trim();
-    if (rawText.startsWith('```')) {
-      rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
-    }
+    const text = await callGemini({
+      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: prompt }] }],
+      generationConfig: { responseMimeType: 'application/json' },
+    });
 
-    return {
-      statusCode: 200,
-      headers: { 'Content-Type': 'application/json' },
-      body: rawText
-    };
-  } catch (error) {
-    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
+    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
+    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
+  } catch (e) {
+    console.error('diagnose error:', e.message);
+    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e.message }) };
   }
 };
diff --git a/package.json b/package.json
index 3c97e72..0765a50 100644
--- a/package.json
+++ b/package.json
@@ -1,7 +1,5 @@
 {
   "name": "smart-irrigation",
   "version": "1.0.0",
-  "dependencies": {
-    "@google/generative-ai": "^0.21.0"
-  }
+  "engines": { "node": ">=18" }
 }
-- 
2.43.0
