// frontend/src/App.jsx

import React, { useState } from 'react';
import Setup from './components/Setup';
import Chat from './components/Chat';

export default function App() {
    const [appState, setAppState] = useState(null);

    const handleStart = (config) => {
        // Guarda a configuração enviada pelo Setup
        setAppState(config);
    };

    const handleExit = () => {
        // Reseta o estado para voltar à tela inicial
        setAppState(null);
    };

    return (
        <main className="w-full min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
            {!appState ? (
                <Setup onStart={handleStart} />
            ) : (
                <Chat appState={appState} onExit={handleExit} />
            )}
        </main>
    );
}