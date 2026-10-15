// frontend/src/components/Setup.jsx

import React, { useState } from 'react';

export default function Setup({ onStart }) {
    const [apiKey, setApiKey] = useState('');
    const [persona, setPersona] = useState('alex');
    const [topic, setTopic] = useState('diário');
    const [level, setLevel] = useState('iniciante');
    const [autoSpeak, setAutoSpeak] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();
        onStart({
            apiKey: apiKey.trim(),
            persona,
            topic,
            level,
            autoSpeak
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-full bg-[#0b0f19] p-4">
            <div className="w-full max-w-lg bg-[#111827] border border-[#1f2937] rounded-2xl shadow-2xl p-8 flex flex-col gap-6 text-gray-100">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1">SpeakFlow</h1>
                    <p className="text-sm text-gray-400">Configure sua sessão de prática de inglês</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                            API Key (Google Gemini):
                        </label>
                        <input 
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Insira sua chave de API..."
                            className="bg-[#1f2937] border border-[#374151] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <a 
                            href="https://aistudio.google.com" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-blue-400 hover:underline mt-0.5"
                        >
                            Obtenha grátis em aistudio.google.com
                        </a>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                            Personalidade da IA:
                        </label>
                        <select 
                            value={persona}
                            onChange={(e) => setPersona(e.target.value)}
                            className="bg-[#1f2937] border border-[#374151] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="alex">Alex (Amigo Casual - Bate-papo leve)</option>
                            <option value="sarah">Ms. Sarah (Professora de Inglês - Foco em gramática e dicas)</option>
                            <option value="mr_smith">Mr. Smith (Executivo - Inglês formal de negócios)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                            Tópico:
                        </label>
                        <select 
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            className="bg-[#1f2937] border border-[#374151] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="diário">Conversas do dia a dia (saudações, clima, bate-papo)</option>
                            <option value="viagem">Viagens e Turismo (aeroportos, hotéis, restaurantes)</option>
                            <option value="trabalho">Ambiente de Trabalho e Negócios (reuniões, carreira)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                            Nível de Fluência:
                        </label>
                        <select 
                            value={level}
                            onChange={(e) => setLevel(e.target.value)}
                            className="bg-[#1f2937] border border-[#374151] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        >
                            <option value="iniciante">Iniciante - Frases curtas e vocabulário simples</option>
                            <option value="intermediário">Intermediário - Conversação natural do dia a dia</option>
                            <option value="avançado">Avançado - Expressões idiomáticas e vocabulário rico</option>
                        </select>
                    </div>

                    <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer mt-1 select-none">
                        <input 
                            type="checkbox"
                            checked={autoSpeak}
                            onChange={(e) => setAutoSpeak(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 bg-[#1f2937]"
                        />
                        Falar respostas da IA automaticamente (Text-to-Speech)
                    </label>

                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-3 text-sm transition-colors shadow-lg shadow-blue-600/20 mt-2 cursor-pointer"
                    >
                        Iniciar Prática
                    </button>
                </form>
            </div>
        </div>
    );
}