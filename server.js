// server.js - Node.js Backend for OpenRouter Voice Assistant

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors'); // FIX: Added the official CORS package

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Keys and Model (Hardcoded based on user's .env for reliability)
const OPENROUTER_KEY = "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";
const OPENROUTER_MODEL = "meta-llama/llama-4-scout:free";


// =========================================================
// 1. MIDDLEWARE (The Fix for CORS and silent crash)
// =========================================================

// FIX: Use the cors package to allow requests from the frontend (like 127.0.0.1:5500)
app.use(cors());

// Configure to parse JSON requests
app.use(bodyParser.json());

// Check for critical configuration
if (!OPENROUTER_KEY || !OPENROUTER_MODEL) {
    console.error("FATAL: OPENROUTER_API_KEY or OPENROUTER_MODEL is missing.");
    // If the server crashes here, the error message is clear.
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
        // Robust error handling for Axios network or API errors
        if (error.response) {
            console.error('OpenRouter API Error Status:', error.response.status);
            console.error('OpenRouter API Error Data:', error.response.data);
            const errorMessage = error.response.data.error?.message || "Failed to get response from OpenRouter.";
            // Pass the API error status back to the client
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