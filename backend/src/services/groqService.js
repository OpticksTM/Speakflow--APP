// backend/src/services/groqService.js
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function getChatCompletion(userMessage) {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            model: 'openai/gpt-oss-120b', // <--- Atualizado com o modelo exato da imagem
        });

        return response.choices[0]?.message?.content || "Sem resposta.";
        
    } catch (error) {
        console.error("Erro no serviço do Groq:", error);
        throw error;
    }
}

module.exports = { getChatCompletion };