// frontend/src/services/api.js

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = 45000;

// Envia a mensagem + histórico e devolve o JSON puro da raiz:
// { userLanguage, userTranslation, reply, translation, suggestions: [{ en, pt }] }
export async function sendChatMessage({ message, history = [], persona, topic, level, provider, config = {} }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                message,
                history,
                provider: provider || config.provider || 'gemini',
                persona: persona || config.persona || 'alex',
                topic: topic || config.topic || 'diário',
                level: level || config.level || 'iniciante'
            })
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
            throw new Error(base + details);
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