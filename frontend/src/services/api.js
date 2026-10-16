// frontend/src/services/api.js

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = 45000;

// POST em JSON com timeout e mensagens de erro úteis. Devolve o JSON puro da raiz.
// Em caso de erro, o Error traz: code (ex.: "NO_SPEECH"), status e data (corpo da resposta).
async function postJson(path, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload)
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            const base = (data && data.error) || `Erro ${response.status} ao comunicar com a IA`;
            const details = data && data.details ? ` (${String(data.details).slice(0, 160)})` : '';
            const error = new Error(base + details);
            error.code = data && data.code;
            error.status = response.status;
            error.data = data;
            throw error;
        }

        if (!data || typeof data !== 'object') {
            throw new Error('Resposta inválida do servidor.');
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('A IA demorou demais para responder. Tente novamente.');
        }
        if (error instanceof TypeError) {
            throw new Error('Não foi possível conectar ao servidor. O backend está rodando?');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Chat livre (texto). Devolve:
// { userLanguage, userTranslation, correction, reply, translation, suggestions: [{ en, pt }] }
export async function sendChatMessage({ message, history = [], persona, topic, level, provider, config = {} }) {
    return postJson('/chat', {
        message,
        history,
        provider: provider || config.provider || 'gemini',
        persona: persona || config.persona || 'alex',
        topic: topic || config.topic || 'diário',
        level: level || config.level || 'iniciante'
    });
}

// Voz -> conversa. O servidor transcreve (detecta português/inglês sozinho) e responde.
// Devolve o mesmo formato do chat, mais "heard" (o que foi ouvido).
export async function sendVoiceMessage({ audio, mimeType, history = [], persona, topic, level, provider, config = {} }) {
    return postJson('/voice', {
        audio,
        mimeType,
        history,
        provider: provider || config.provider || 'gemini',
        persona: persona || config.persona || 'alex',
        topic: topic || config.topic || 'diário',
        level: level || config.level || 'iniciante'
    });
}

// Só transcreve (usado no treino "Repetir"). Devolve { text }.
export async function transcribeAudio({ audio, mimeType, language }) {
    return postJson('/transcribe', { audio, mimeType, language });
}

// Frase rápida (português -> inglês). Devolve:
// { original, english, alternatives: [{ label, en }], tip }
export async function translatePhrase({ text, topic, level, provider, config = {} }) {
    return postJson('/translate', {
        text,
        provider: provider || config.provider || 'gemini',
        topic: topic || config.topic || 'diário',
        level: level || config.level || 'iniciante'
    });
}