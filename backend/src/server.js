// backend/src/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createTables } = require('./models/initDb');
const db = require('./config/db');
const { getGroqChatCompletion } = require('./services/groqService');
const { getGeminiChatCompletion } = require('./services/geminiService');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const PORT = process.env.PORT || 3000;

// Inicializa as tabelas sem derrubar o servidor se o banco estiver fora do ar
Promise.resolve(createTables()).catch(err => {
    console.error('Erro ao inicializar as tabelas do banco:', err.message);
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Rota de chat: recebe { message, history, persona, topic, level, provider }
// e devolve na raiz { userLanguage, userTranslation, reply, translation, suggestions }
app.post('/api/chat', async (req, res) => {
    // Declarado fora do try para que o catch também enxergue (bug do server.js antigo)
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
        let aiData;
        let usedProvider = provider;

        try {
            aiData = provider === 'groq'
                ? await getGroqChatCompletion(message, context)
                : await getGeminiChatCompletion(message, context);
        } catch (primaryError) {
            // Se o Gemini falhou (ex.: 503 de alta demanda) e existe chave do Groq, usa o Groq como plano B
            const canFallback = provider !== 'groq' && process.env.GROQ_API_KEY;
            if (!canFallback) throw primaryError;

            console.warn(`Gemini falhou (${String(primaryError.message).slice(0, 120)}). Usando Groq como plano B.`);
            try {
                aiData = await getGroqChatCompletion(message, context);
                usedProvider = 'groq';
            } catch (fallbackError) {
                console.error('O plano B (Groq) também falhou:', fallbackError.message);
                throw primaryError;
            }
        }

        // Salvar no banco é secundário: se falhar, o chat continua funcionando
        try {
            await db.query(
                'INSERT INTO conversations (user_id, ai_model, prompt, response) VALUES ($1, $2, $3, $4)',
                [userId, usedProvider, message, JSON.stringify(aiData)]
            );
        } catch (dbError) {
            console.error('Aviso: não foi possível salvar a conversa no banco:', dbError.message);
        }

        // JSON limpo direto na raiz, sem aninhar em res.body.reply.reply
        return res.json(aiData);
    } catch (error) {
        // Erro real, sem resposta falsa: o frontend decide o que mostrar
        console.error(`Erro na rota /api/chat (provider: ${provider}):`, error);
        return res.status(502).json({
            error: 'Falha ao gerar a resposta da IA.',
            details: error && error.message ? error.message : String(error)
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

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});