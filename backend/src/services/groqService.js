// backend/src/services/groqService.js
const Groq = require('groq-sdk');
const { buildSystemInstruction, buildTurns } = require('../utils/prompt');
const { parseAiJson, normalizeAiResponse } = require('../utils/aiJson');
const { buildTranslateInstruction, normalizeTranslation } = require('../utils/translate');

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

// Chamada genérica com uma nova tentativa quando o JSON vem malformado
async function runJsonCompletion(messages, temperature, parse) {
    const groq = getClient();
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await groq.chat.completions.create({
                model: MODEL,
                messages,
                temperature,
                response_format: { type: 'json_object' }
            });

            const rawText = response.choices && response.choices[0] && response.choices[0].message
                ? response.choices[0].message.content
                : '';
            return parse(rawText);
        } catch (error) {
            lastError = error;
            if (!error.isFormatError) break;
            console.warn(`[Groq] Formato inválido (tentativa ${attempt}/2):`, error.message);
        }
    }

    throw lastError;
}

// ---------- Chat livre ----------
async function getGroqChatCompletion(userMessage, context = {}) {
    // Histórico real em messages (user/assistant) + a mensagem atual no fim
    const messages = [
        { role: 'system', content: buildSystemInstruction(context) },
        ...buildTurns(context.history, userMessage)
    ];

    return runJsonCompletion(messages, 0.9, raw => normalizeAiResponse(parseAiJson(raw), userMessage));
}

// ---------- Frase rápida (português -> inglês) ----------
async function getGroqTranslation(text, context = {}) {
    const messages = [
        { role: 'system', content: buildTranslateInstruction(context) },
        { role: 'user', content: text }
    ];

    return runJsonCompletion(messages, 0.3, raw => normalizeTranslation(parseAiJson(raw), text));
}

module.exports = { getGroqChatCompletion, getGroqTranslation };