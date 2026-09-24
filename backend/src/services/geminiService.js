// backend/src/services/geminiService.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getGeminiChatCompletion(userMessage) {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: userMessage,
        });

        if (response && response.text) {
            return response.text;
        }

        return "Sem resposta detalhada do Gemini.";
        
    } catch (error) {
        console.error("Erro detalhado do Gemini:", JSON.stringify(error, null, 2));
        throw error;
    }
}

module.exports = { getGeminiChatCompletion };