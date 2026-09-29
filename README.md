# Smart-Irrigation-System
Description: Smart Irrigation &amp; Farm Management PWA featuring real-time soil/moisture monitoring, Open-Meteo per-location weather forecasting, AI-powered leaf disease diagnosis, local cost ledgers, and multi-language support (English &amp; Swahili).
# 🌾 Smart Irrigation & Farm Management App

A progressive web application (PWA) designed for farmers in East Africa to monitor soil metrics, manage multi-zone plots, automate weather-based irrigation skipping, diagnose crop leaf diseases using AI, and track farming ledgers.

## ✨ Key Features

* **Multi-Farm & Zone Management:** Monitor multiple plots (Kiambu, Nakuru, Machakos) tracking soil pH, moisture levels, temperatures, and water tank capacities[cite: 1, 3].
* **Live Weather Integration:** Pulls real-time temperature, conditions, and precipitation forecasts dynamically via the Open-Meteo API based on each farm's coordinates[cite: 1, 3].
* **AI Leaf Doctor:** Uses computer vision and AI to scan crop leaves, detect diseases (such as early/late blight), and provide instant treatment plans[cite: 1, 3].
* **Cloud & Device Voice Readout:** Reads critical farm alerts aloud using high-definition cloud text-to-speech with a built-in browser fallback.
* **Bilingual Support:** Full seamless interface toggle between **English** and **Swahili (Kiswahili)**[cite: 3].
* **Smart Ledger & Cost Calculator:** Calculate local amendment costs (like agricultural lime), track harvest timelines, download custom CSV reports, and log water/money savings[cite: 1, 3].
* **AI Farm Assistant:** Integrated chat assistant powered by Gemini to answer region-specific agronomy questions[cite: 1, 3].

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Responsive mobile-first card layout)[cite: 1, 3].
* **APIs:** Open-Meteo Weather API, Gemini Vision/Text API, Cloud Text-to-Speech[cite: 1, 3].
* **Deployment:** Netlify (with serverless functions in `netlify/functions/`)[cite: 1, 2, 3].

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone [https://github.com/your-username/smart-irrigation.git](https://github.com/your-username/smart-irrigation.git)
