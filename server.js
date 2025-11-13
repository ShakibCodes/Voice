// server.js - Node.js Backend for OpenRouter Voice Assistant

const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors'); 
const path = require('path'); 

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Keys and Model (Loaded from environment variables for deployment)
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY; // <<< NEW: Load ElevenLabs Key

// --- ElevenLabs Configuration ---
const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (Natural, Expressive Voice)
const ELEVENLABS_API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;

// =========================================================
// 1. MIDDLEWARE
// =========================================================

app.use(cors());
app.use(bodyParser.json());

// Check for critical configuration
if (!OPENROUTER_KEY || !OPENROUTER_MODEL || !ELEVENLABS_KEY) { 
    console.error("FATAL: One or more API keys (OpenRouter or ElevenLabs) or OPENROUTER_MODEL is missing.");
    process.exit(1); 
}

// =========================================================
// 2. ROOT ROUTE FIX (Serves index.html)
// =========================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================
// 3. API ROUTE (Combines LLM & TTS Streaming)
// NOTE: Replaced the old /api/process-text with /api/chat
// =========================================================

app.post('/api/chat', async (req, res) => {
    // The frontend now sends the query under the 'query' key
    const userMessage = req.body.query; 

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    req.setTimeout(60000); // 60 seconds timeout

    try {
        // --- STEP 1: Get Text Response from OpenRouter ---
        console.log(`Received query: "${userMessage}"`);

        const openRouterResponse = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: OPENROUTER_MODEL,
                messages: [
                    { role: 'system', content: 'You are a concise, helpful, and natural-sounding voice assistant. Keep your answers brief and conversational, as they will be spoken aloud.' },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 150, 
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'Voice Assistant Project (Axios)', 
                }
            }
        );

        const aiResponseText = openRouterResponse.data.choices[0].message.content;
        console.log('OpenRouter Response (Text):', aiResponseText);
        
        // --- STEP 2: Start Headers and Send Text Metadata ---
        
        // Send the text content as a custom header before starting the stream
        res.set('X-AI-Response-Text', encodeURIComponent(aiResponseText));
        
        // Set content type for audio streaming
        res.set({
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache', 
        });
        
        // --- STEP 3: Convert Text to Speech using ElevenLabs and Stream ---
        const elevenLabsResponse = await axios.post(
            ELEVENLABS_API_URL,
            {
                text: aiResponseText,
                model_id: "eleven_multilingual_v2", 
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                },
            },
            {
                headers: {
                    'xi-api-key': ELEVENLABS_KEY, 
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg', 
                },
                responseType: 'stream', 
            }
        );

        // Pipe the audio stream directly from ElevenLabs to the client
        elevenLabsResponse.data.pipe(res);
        
        elevenLabsResponse.data.on('end', () => {
            console.log('Audio stream finished successfully.');
        });

        elevenLabsResponse.data.on('error', (err) => {
            console.error('ElevenLabs Audio Stream Error:', err.message);
            res.end(); 
        });


    } catch (error) {
        if (error.response) {
            console.error('API Error Status:', error.response.status);
            if (!res.headersSent) {
                const errorMessage = error.response.data.error?.message || "Failed to get response from API.";
                return res.status(error.response.status || 500).json({ error: errorMessage });
            }
        } else {
            console.error('--- FATAL BACKEND PROCESSING ERROR ---', error.message);
            if (!res.headersSent) {
                 res.status(500).json({ error: `Internal Server Error: ${error.message}` });
            }
        }
        if (res.headersSent) {
            res.end();
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Using LLM: ${OPENROUTER_MODEL}`);
});