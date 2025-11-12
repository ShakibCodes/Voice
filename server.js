// server.js - Node.js Backend for OpenRouter Voice Assistant

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); 

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;

// =========================================================
// 1. MIDDLEWARE
// =========================================================

// Configure to parse JSON requests (the frontend will send text as JSON)
app.use(bodyParser.json());

// Enable CORS for frontend running locally
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

if (!OPENROUTER_KEY || !OPENROUTER_MODEL) {
    console.error("FATAL: OPENROUTER_API_KEY or OPENROUTER_MODEL is missing in .env file.");
    process.exit(1);
}

// =========================================================
// 2. API ENDPOINT (Text-to-Text)
// =========================================================

// This endpoint expects a JSON body with the 'query' key.
app.post('/api/process-text', async (req, res) => {
    try {
        const userQuery = req.body.query;

        if (!userQuery) {
            return res.status(400).json({ error: 'Missing text query in request body.' });
        }

        console.log(`Received query: "${userQuery}"`);

        // --- OpenRouter API Call ---
        const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                // IMPORTANT: Use the provided API Key
                'Authorization': `Bearer ${OPENROUTER_KEY}`, 
                'Content-Type': 'application/json',
                // OpenRouter requires the HTTP-Referer or X-Title for tracking free usage
                'HTTP-Referer': 'Voice Assistant Project (meta-llama/llama-4-scout:free)', 
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'You are a concise, helpful, and natural-sounding voice assistant. Keep your answers brief and conversational, as they will be spoken aloud.' },
                    { role: 'user', content: userQuery }
                ],
                // Ensure a quick, concise response
                max_tokens: 150, 
            }),
        });

        const data = await openRouterResponse.json();

        if (!openRouterResponse.ok) {
            console.error('OpenRouter Error Data:', data);
            // Handle specific OpenRouter errors like rate limits or invalid model
            const errorMessage = data.error?.message || "Failed to get response from OpenRouter.";
            return res.status(data.status || 500).json({ error: errorMessage });
        }

        const aiResponseText = data.choices[0].message.content;
        console.log('OpenRouter Response:', aiResponseText);

        // Send the text response back to the frontend
        res.json({
            text: aiResponseText,
        });

    } catch (error) {
        console.error('--- FATAL BACKEND PROCESSING ERROR ---', error);
        res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using LLM: ${OPENROUTER_MODEL}`);
});