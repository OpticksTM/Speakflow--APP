// backend/src/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createTables } = require('./models/initDb');
const db = require('./config/db');
const { getGroqChatCompletion, getGroqTranslation } = require('./services/groqService');
const { getGeminiChatCompletion, getGeminiTranslation } = require('./services/geminiService');
const { transcribeAudio, TranscriptionError } = require('./services/transcribeService');

const app = express();
// As rotas de voz recebem o áudio em base64 e precisam de um limite maior que as demais
app.use('/api/voice', express.json({ limit: '12mb' }));
app.use('/api/transcribe', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const MAX_TRANSLATE_CHARS = 600;

// Inicializa as tabelas sem derrubar o servidor se o banco estiver fora do ar
Promise.resolve(createTables()).catch(err => {
    console.error('Erro ao inicializar as tabelas do banco:', err.message);
});

// Executa o provedor escolhido; se o Gemini falhar (ex.: 503 de alta demanda) e existir
// chave do Groq, usa o Groq como plano B. Devolve { data, usedProvider }.
async function callWithProviderFallback(provider, geminiCall, groqCall) {
    try {
        const data = provider === 'groq' ? await groqCall() : await geminiCall();
        return { data, usedProvider: provider };
    } catch (primaryError) {
        const canFallback = provider !== 'groq' && process.env.GROQ_API_KEY;
        if (!canFallback) throw primaryError;

        console.warn(`Gemini falhou (${String(primaryError.message).slice(0, 120)}). Usando Groq como plano B.`);
        try {
            const data = await groqCall();
            return { data, usedProvider: 'groq' };
        } catch (fallbackError) {
            console.error('O plano B (Groq) também falhou:', fallbackError.message);
            throw primaryError;
        }
    }
}

// Salvar no banco é secundário: se falhar, o app continua funcionando
async function saveConversation(userId, provider, prompt, response) {
    try {
        await db.query(
            'INSERT INTO conversations (user_id, ai_model, prompt, response) VALUES ($1, $2, $3, $4)',
            [userId, provider, prompt, JSON.stringify(response)]
        );
    } catch (dbError) {
        console.error('Aviso: não foi possível salvar no banco:', dbError.message);
    }
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Chat livre: recebe { message, history, persona, topic, level, provider }
// e devolve na raiz { userLanguage, userTranslation, reply, translation, suggestions }
app.post('/api/chat', async (req, res) => {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
        return res.status(400).json({ error: 'A mensagem é obrigatória.' });
    }

    // Aceita as configurações na raiz ou dentro de body.config
    const config = body.config || {};
    const userId = body.userId || 1;
    const provider = String(body.provider || config.provider || 'gemini').toLowerCase();
    const context = {
        persona: body.persona || config.persona || 'friendly',
        topic: body.topic || config.topic || 'daily',
        level: body.level || config.level || 'beginner',
        history: Array.isArray(body.history) ? body.history : (Array.isArray(config.history) ? config.history : [])
    };

    try {
        const { data, usedProvider } = await callWithProviderFallback(
            provider,
            () => getGeminiChatCompletion(message, context),
            () => getGroqChatCompletion(message, context)
        );

        await saveConversation(userId, usedProvider, message, data);
        return res.json(data);
    } catch (error) {
        console.error(`Erro na rota /api/chat (provider: ${provider}):`, error);
        return res.status(502).json({
            error: 'Falha ao gerar a resposta da IA.',
            details: error && error.message ? error.message : String(error)
        });
    }
});

// Frase rápida: recebe { text, topic, level, provider }
// e devolve { original, english, alternatives: [{ label, en }], tip }
app.post('/api/translate', async (req, res) => {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
        return res.status(400).json({ error: 'O texto é obrigatório.' });
    }
    if (text.length > MAX_TRANSLATE_CHARS) {
        return res.status(400).json({ error: `Texto muito longo (máximo ${MAX_TRANSLATE_CHARS} caracteres).` });
    }

    const config = body.config || {};
    const userId = body.userId || 1;
    const provider = String(body.provider || config.provider || 'gemini').toLowerCase();
    const context = {
        topic: body.topic || config.topic || 'daily',
        level: body.level || config.level || 'beginner'
    };

    try {
        const { data, usedProvider } = await callWithProviderFallback(
            provider,
            () => getGeminiTranslation(text, context),
            () => getGroqTranslation(text, context)
        );

        await saveConversation(userId, usedProvider, text, data);
        return res.json(data);
    } catch (error) {
        console.error(`Erro na rota /api/translate (provider: ${provider}):`, error);
        return res.status(502).json({
            error: 'Falha ao gerar a tradução.',
            details: error && error.message ? error.message : String(error)
        });
    }
});

// Erros de transcrição têm status e código próprios (sem chave, sem fala, formato inválido...)
function sendTranscriptionError(res, error, routeName) {
    if (error instanceof TranscriptionError) {
        return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error(`Erro na rota ${routeName}:`, error);
    return res.status(502).json({
        error: 'Falha ao processar a voz.',
        details: error && error.message ? error.message : String(error)
    });
}

// Só transcreve: recebe { audio (base64), mimeType, language? } e devolve { text }
// Usada no treino de pronúncia ("Repetir"), onde só interessa o que você falou.
app.post('/api/transcribe', async (req, res) => {
    const body = req.body || {};
    try {
        const { text } = await transcribeAudio({
            audio: body.audio,
            mimeType: body.mimeType,
            language: body.language
        });
        return res.json({ text });
    } catch (error) {
        return sendTranscriptionError(res, error, '/api/transcribe');
    }
});

// Voz -> conversa: recebe { audio (base64), mimeType, history, persona, topic, level, provider }
// Transcreve (detectando português/inglês sozinho) e responde como o /api/chat,
// devolvendo também o que foi ouvido em "heard".
app.post('/api/voice', async (req, res) => {
    const body = req.body || {};

    let heard;
    try {
        ({ text: heard } = await transcribeAudio({ audio: body.audio, mimeType: body.mimeType }));
    } catch (error) {
        return sendTranscriptionError(res, error, '/api/voice');
    }

    const config = body.config || {};
    const userId = body.userId || 1;
    const provider = String(body.provider || config.provider || 'gemini').toLowerCase();
    const context = {
        persona: body.persona || config.persona || 'friendly',
        topic: body.topic || config.topic || 'daily',
        level: body.level || config.level || 'beginner',
        history: Array.isArray(body.history) ? body.history : []
    };

    try {
        const { data, usedProvider } = await callWithProviderFallback(
            provider,
            () => getGeminiChatCompletion(heard, context),
            () => getGroqChatCompletion(heard, context)
        );

        await saveConversation(userId, usedProvider, heard, data);
        return res.json({ heard, ...data });
    } catch (error) {
        console.error(`Erro na rota /api/voice (provider: ${provider}):`, error);
        // Devolve o que foi ouvido para o app poder mostrar e permitir tentar de novo
        return res.status(502).json({
            error: 'Falha ao gerar a resposta da IA.',
            details: error && error.message ? error.message : String(error),
            heard
        });
    }
});

app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(
            'SELECT id, ai_model, prompt, response, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ total: result.rows.length, conversations: result.rows });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error.message);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// Erros do Express (corpo grande demais, JSON inválido) sempre em JSON
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Áudio muito longo. Fale frases mais curtas.', code: 'AUDIO_TOO_LARGE' });
    }
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Requisição inválida.' });
    }
    console.error('Erro não tratado:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});