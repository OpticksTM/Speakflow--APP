const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createTables } = require('./models/initDb');
const db = require('./config/db');
const { getGroqChatCompletion } = require('./services/groqService');
const { getGeminiChatCompletion } = require('./services/geminiService');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Inicializa as tabelas e o utilizador padrão ao arrancar o servidor
createTables();

// Rota para o Groq
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId = 1 } = req.body;
        
        // Validação de erro de input (retorna 400 se a mensagem não existir)
        if (!message) {
            return res.status(400).json({ erro: 'A mensagem é obrigatória.' });
        }

        const aiResponse = await getGroqChatCompletion(message);

        // Grava no PostgreSQL
        await db.query(
            'INSERT INTO conversations (user_id, ai_model, prompt, response) VALUES ($1, $2, $3, $4)',
            [userId, 'groq', message, aiResponse]
        );

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Erro na rota /api/chat:', error);
        res.status(500).json({ erro: 'Falha ao se comunicar com o Groq.' });
    }
});

// Rota para o Gemini
app.post('/api/gemini', async (req, res) => {
    try {
        const { message, userId = 1 } = req.body;
        
        // Validação de erro de input (retorna 400 se a mensagem não existir)
        if (!message) {
            return res.status(400).json({ erro: 'A mensagem é obrigatória.' });
        }

        const aiResponse = await getGeminiChatCompletion(message);

        // Grava no PostgreSQL
        await db.query(
            'INSERT INTO conversations (user_id, ai_model, prompt, response) VALUES ($1, $2, $3, $4)',
            [userId, 'gemini', message, aiResponse]
        );

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Erro detalhado do Gemini:', JSON.stringify(error, null, 2));
        res.status(500).json({ erro: 'Falha ao se comunicar com o Gemini.' });
    }
});

// Rota para listar o histórico de conversas do utilizador
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await db.query(
            'SELECT id, ai_model, prompt, response, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        res.json({
            total: result.rows.length,
            conversations: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ erro: 'Falha ao recuperar o histórico de conversas.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});