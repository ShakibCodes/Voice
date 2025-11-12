// server.js - Node.js Backend for OpenRouter Voice Assistant (v3 - using Axios)

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
// FIX: Using Axios as a reliable HTTP client alternative to node-fetch
const axios = require('axios'); 

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
// Note: Using the key/model provided by the user
const OPENROUTER_KEY = "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";
const OPENROUTER_MODEL = "meta-llama/llama-4-scout:free";


// =========================================================
// 1. MIDDLEWARE
// =========================================================

app.use(bodyParser.json());

// Enable CORS for frontend running locally
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

if (!OPENROUTER_KEY || !OPENROUTER_MODEL) {
    console.error("FATAL: OPENROUTER_API_KEY or OPENROUTER_MODEL is missing.");
    process.exit(1);
}

// =========================================================
// 2. API ENDPOINT (Text-to-Text)
// =========================================================

app.post('/api/process-text', async (req, res) => {
    try {
        const userQuery = req.body.query;

        if (!userQuery) {
            return res.status(400).json({ error: 'Missing text query in request body.' });
        }

        console.log(`Received query: "${userQuery}"`);

        // --- OpenRouter API Call using Axios ---
        const openRouterResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'You are a concise, helpful, and natural-sounding voice assistant. Keep your answers brief and conversational, as they will be spoken aloud.' },
                    { role: 'user', content: userQuery }
                ],
                max_tokens: 150, 
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`, 
                    'Content-Type': 'application/json',
                    // OpenRouter requires a referer for tracking free usage
                    'HTTP-Referer': 'Voice Assistant Project (Axios)', 
                }
            }
        );

        // Axios uses .data directly for the response body
        const aiResponseText = openRouterResponse.data.choices[0].message.content;
        console.log('OpenRouter Response:', aiResponseText);

        // Send the text response back to the frontend
        res.json({
            text: aiResponseText,
        });

    } catch (error) {
        // Axios error handling is slightly different
        if (error.response) {
            // API responded with an error (e.g., 401, 429)
            console.error('OpenRouter API Error Status:', error.response.status);
            console.error('OpenRouter API Error Data:', error.response.data);
            const errorMessage = error.response.data.error?.message || "Failed to get response from OpenRouter.";
            return res.status(error.response.status || 500).json({ error: errorMessage });
        } else {
            // General network or setup error
            console.error('--- FATAL BACKEND PROCESSING ERROR ---', error.message);
            res.status(500).json({ error: `Internal Server Error: ${error.message}` });
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using LLM: ${OPENROUTER_MODEL}`);
});