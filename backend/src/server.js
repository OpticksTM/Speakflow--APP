const express = require('express');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do ficheiro .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para aceitar JSON no corpo das requisições
app.use(express.json());

// Importação dos serviços de IA
const { getChatCompletion } = require('./services/groqService');
const { getGeminiChatCompletion } = require('./services/geminiService');

// Rota de teste inicial (Health Check)
app.get('/', (req, res) => {
    res.status(200).json({ status: "Servidor SpeakFlow a funcionar com sucesso!" });
});

// Rota POST para o Groq
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ erro: "A mensagem é obrigatória." });
        }

        const aiResponse = await getChatCompletion(message);

        res.status(200).json({ response: aiResponse });
    } catch (error) {
        console.error("Erro na rota /api/chat:", error);
        res.status(500).json({ erro: "Falha ao se comunicar com a IA (Groq)." });
    }
});

// Rota POST para o Gemini
app.post('/api/gemini', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ erro: "A mensagem é obrigatória." });
        }

        const aiResponse = await getGeminiChatCompletion(message);

        res.status(200).json({ response: aiResponse });
    } catch (error) {
        console.error("Erro na rota /api/gemini:", error);
        res.status(500).json({ erro: "Falha ao se comunicar com o Gemini." });
    }
});

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});