// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import Talk from './components/Talk';
import Chat from './components/Chat';
import Quick from './components/Quick';

const SETTINGS_KEY = 'speakflow_settings_v1';

// Valores iniciais: o app abre direto na tela de voz, sem passar por configuração
const DEFAULT_SETTINGS = {
    persona: 'alex',
    topic: 'diário',
    level: 'iniciante',
    autoSpeak: true,
    handsFree: false,
    showTranslations: true
};

function loadSettings() {
    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                // A chave de API nunca é guardada no navegador (o backend usa a do .env)
                const { apiKey, ...rest } = parsed;
                return { ...DEFAULT_SETTINGS, ...rest };
            }
        }
    } catch {
        // dados inválidos ou armazenamento indisponível: usa os valores iniciais
    }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    try {
        const { apiKey, ...safeSettings } = settings;
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings));
    } catch {
        // sem armazenamento: segue sem salvar
    }
}

export default function App() {
    const [settings, setSettings] = useState(() => loadSettings());
    const [mode, setMode] = useState('talk'); // 'talk' = voz | 'chat' = conversa por texto | 'quick' = frase rápida

    useEffect(() => {
        saveSettings(settings);
    }, [settings]);

    const handleChangeSettings = (partial) => {
        setSettings(prev => ({ ...prev, ...partial }));
    };

    return (
        <main className="w-full min-h-screen bg-[#040B18] flex items-center justify-center p-2 sm:p-4">
            {mode === 'talk' && (
                <Talk
                    settings={settings}
                    onChangeSettings={handleChangeSettings}
                    onOpenChat={() => setMode('chat')}
                    onOpenQuick={() => setMode('quick')}
                />
            )}
            {mode === 'chat' && (
                <Chat appState={settings} onExit={() => setMode('talk')} onSwitchMode={() => setMode('quick')} />
            )}
            {mode === 'quick' && (
                <Quick appState={settings} onExit={() => setMode('talk')} onSwitchMode={() => setMode('chat')} />
            )}
        </main>
    );
}