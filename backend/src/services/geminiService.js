// backend/src/services/geminiService.js
const { GoogleGenAI } = require('@google/genai');
const { buildSystemInstruction, buildTurns } = require('../utils/prompt');
const { parseAiJson, normalizeAiResponse } = require('../utils/aiJson');

// gemini-1.5-flash, 2.0-flash e 2.5-flash foram desligados pelo Google (retornam 404).
// O Flash-Lite é rápido, barato e feito para chatbots, e costuma sofrer menos com erro 503 de alta demanda.
// Para trocar de modelo sem mexer no código, defina GEMINI_MODEL no .env (ex.: gemini-3.5-flash).
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
// Modelo reserva usado se o principal continuar sobrecarregado (503). Opcional: GEMINI_FALLBACK_MODEL
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash-preview';
const RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS || 1000);
const MAX_ATTEMPTS_PRIMARY = 3;
const MAX_ATTEMPTS_FALLBACK = 2;

let client = null;
function getClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não está definida no arquivo .env');
    }
    if (!client) {
        client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return client;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Erros temporários: sobrecarga (503), limite de taxa (429), erro interno (500) ou timeout (504)
function isTransientError(error) {
    if (!error) return false;
    const status = Number(error.status || error.code);
    if ([429, 500, 502, 503, 504].includes(status)) return true;
    const msg = String(error.message || '');
    return /"code"\s*:\s*(429|500|502|503|504)\b/.test(msg) ||
        /high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|try again later/i.test(msg);
}

async function callModel(model, contents, systemInstruction, userMessage) {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.9
        }
    });

    // Na SDK nova, response.text é uma propriedade (getter), não uma função
    const rawText = typeof response.text === 'function' ? response.text() : response.text;
    return normalizeAiResponse(parseAiJson(rawText), userMessage);
}

// Tenta o mesmo modelo algumas vezes: JSON malformado tenta na hora, 503/429 espera e tenta de novo
async function callWithRetry(model, maxAttempts, contents, systemInstruction, userMessage) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await callModel(model, contents, systemInstruction, userMessage);
        } catch (error) {
            lastError = error;
            const retryable = error.isFormatError || isTransientError(error);
            if (!retryable || attempt === maxAttempts) break;

            const waitMs = error.isFormatError ? 0 : RETRY_BASE_MS * Math.pow(2.5, attempt - 1);
            console.warn(`[Gemini:${model}] tentativa ${attempt}/${maxAttempts} falhou (${String(error.message).slice(0, 120)}). ` +
                (waitMs ? `Nova tentativa em ${Math.round(waitMs)}ms.` : 'Tentando de novo.'));
            if (waitMs) await sleep(waitMs);
        }
    }

    throw lastError;
}

async function getGeminiChatCompletion(userMessage, context = {}) {
    // Histórico real com papéis user/model + a mensagem atual como último turno
    const contents = buildTurns(context.history, userMessage).map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }]
    }));
    const systemInstruction = buildSystemInstruction(context);

    try {
        return await callWithRetry(MODEL, MAX_ATTEMPTS_PRIMARY, contents, systemInstruction, userMessage);
    } catch (primaryError) {
        // Se o modelo principal está sobrecarregado, tenta o modelo reserva antes de desistir
        if (isTransientError(primaryError) && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
            console.warn(`[Gemini] ${MODEL} indisponível. Tentando o modelo reserva ${FALLBACK_MODEL}.`);
            try {
                return await callWithRetry(FALLBACK_MODEL, MAX_ATTEMPTS_FALLBACK, contents, systemInstruction, userMessage);
            } catch (fallbackError) {
                console.warn(`[Gemini] Modelo reserva também falhou: ${String(fallbackError.message).slice(0, 120)}`);
            }
        }
        throw primaryError;
    }
}

module.exports = { getGeminiChatCompletion, isTransientError };