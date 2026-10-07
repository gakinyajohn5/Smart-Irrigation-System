# Smart-Irrigation-System
Smart Irrigation & Farm Management PWA featuring real-time soil/moisture monitoring, Open-Meteo per-location weather forecasting, AI-powered leaf disease diagnosis, local cost ledgers, and multi-language support (English &amp; Swahili).
# 🌾 Smart Irrigation & Farm Management App

A progressive web application (PWA) designed for farmers in East Africa to monitor soil metrics, manage multi-zone plots, automate weather-based irrigation skipping, diagnose crop leaf diseases using AI, and track farming ledgers.

## ✨ Key Features

* **Multi-Farm & Zone Management:** Monitor multiple plots (Kiambu, Nakuru, Machakos) tracking soil pH, moisture levels, temperatures, and water tank capacities.
* **Live Weather Integration:** Pulls real-time temperature, conditions, and precipitation forecasts dynamically via the Open-Meteo API based on each farm's coordinates.
* **AI Leaf Doctor:** Uses computer vision and AI to scan crop leaves, detect diseases (such as early/late blight), and provide instant treatment plans.
* **Cloud & Device Voice Readout:** Reads critical farm alerts aloud using high-definition cloud text-to-speech with a built-in browser fallback.
* **Bilingual Support:** Full seamless interface toggle between **English** and **Swahili (Kiswahili)**.
* **Smart Ledger & Cost Calculator:** Calculate local amendment costs (like agricultural lime), track harvest timelines, download custom CSV reports, and log water/money savings.
* **AI Farm Assistant:** Integrated chat assistant powered by Gemini to answer region-specific agronomy questions.
* **Morning or Evening Irrigation:** Choose when automatic irrigation runs (morning 05:00-09:00 or evening 17:00-19:00) from the Smart care screen or the dashboard. Dry zones wait for the window; very dry soil is watered at any time. Dragging the sun on the dashboard moves the clock, so irrigation starts and stops with the time of day.
* **Crop-Aware Watering:** Set the crop in each zone. Each crop has its own start level, stop level, weekly water need and pH range (`crops.js`). The Irrigate button warns and explains, based on the plant, when the soil is already wet enough, when it is the wrong time of day, or when heavy rain is coming.
* **Soil pH Control:** The app knows each zone's pH and the crop's range, tells you whether to add lime or sulfur and roughly how much, and the Apply buttons move the pH toward the crop's range without overshooting. An "Ask AI" button explains the zone in plain language (needs `GEMINI_API_KEY`; the built-in crop rules work without it).

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Responsive mobile-first card layout).
* **APIs:** Open-Meteo Weather API, Gemini Vision/Text API, Cloud Text-to-Speech.
* **Deployment:** Netlify (with serverless functions in `netlify/functions/`).

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/gakinyajohn5/Smart-Irrigation-System.git
   cd Smart-Irrigation-System
   ```
2. Install the Netlify CLI and run locally (needed for the serverless functions):
   ```bash
   npm i -g netlify-cli
   netlify dev
   ```
3. Set these environment variables in Netlify (Site settings → Environment variables), or in a local `.env`:
   * `GEMINI_API_KEY` (required: leaf doctor and farm assistant)
   * `ELEVENLABS_API_KEY` (optional: cloud voice readout; the browser voice is used as fallback)
   * `GEMINI_MODEL`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` (optional overrides)

## 📄 License

Proprietary. All rights reserved by Elite Squad Developers. See `LICENCE`.
