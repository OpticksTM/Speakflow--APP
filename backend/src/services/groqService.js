// backend/src/services/groqService.js
const Groq = require('groq-sdk');
const { buildSystemInstruction, buildTurns } = require('../utils/prompt');
const { parseAiJson, normalizeAiResponse } = require('../utils/aiJson');

// llama-3.3-70b-specdec foi descontinuado; este é o modelo que o app vanilla já usava.
// Para trocar sem mexer no código, defina GROQ_MODEL no .env.
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let client = null;
function getClient() {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não está definida no arquivo .env');
    }
    if (!client) {
        client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return client;
}

async function getGroqChatCompletion(userMessage, context = {}) {
    const groq = getClient();

    // Histórico real em messages (user/assistant) + a mensagem atual no fim
    const messages = [
        { role: 'system', content: buildSystemInstruction(context) },
        ...buildTurns(context.history, userMessage)
    ];

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages,
                temperature: 0.9,
                response_format: { type: 'json_object' }
            });

            const rawText = response.choices && response.choices[0] && response.choices[0].message
                ? response.choices[0].message.content
                : '';
            return normalizeAiResponse(parseAiJson(rawText), userMessage);
        } catch (error) {
            lastError = error;
            if (!error.isFormatError) break;
            console.warn(`[Groq] Formato inválido (tentativa ${attempt}/2):`, error.message);
        }
    }

    throw lastError;
}

module.exports = { getGroqChatCompletion };