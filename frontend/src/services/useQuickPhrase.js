// frontend/src/services/useQuickPhrase.js
// Modo "Frase rápida": você fala em português, recebe a frase em inglês e treina repetindo.

import { useState, useEffect, useRef, useCallback } from 'react';
import { translatePhrase } from './api';
import { compareSpeech } from './speechMatch';

const STORAGE_KEY = 'speakflow_recent_phrases_v1';
const MAX_ENTRIES = 20;

function loadEntries() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(item => item && item.id && item.english).slice(0, MAX_ENTRIES);
    } catch {
        return [];
    }
}

function saveEntries(entries) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    } catch {
        // armazenamento indisponível: segue sem salvar
    }
}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let idCounter = 0;
function newId() {
    idCounter += 1;
    return `phrase-${Date.now()}-${idCounter}`;
}

export default function useQuickPhrase(appState) {
    const [entries, setEntries] = useState(() => loadEntries());
    const [activeId, setActiveId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [listening, setListening] = useState(null); // null | 'pt' | 'en'
    const [speechStatus, setSpeechStatus] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [practice, setPractice] = useState(null); // { entryId, heard, words, score }

    // A frase ativa é a escolhida ou, por padrão, a mais recente
    const activeEntry = entries.find(item => item.id === activeId) || entries[0] || null;

    // Refs evitam "closures velhos" nos callbacks do microfone e do teclado
    const appStateRef = useRef(appState);
    const activeEntryRef = useRef(activeEntry);
    const isLoadingRef = useRef(false);
    const listeningRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    useEffect(() => {
        activeEntryRef.current = activeEntry;
    }, [activeEntry]);

    useEffect(() => {
        saveEntries(entries);
    }, [entries]);

    // ---------- Fala (Text-to-Speech) ----------
    const speak = useCallback((text, options = {}) => {
        const { lang = 'en-US', rate = 0.9 } = options;
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;

        const voices = window.speechSynthesis.getVoices();
        const voice =
            voices.find(v => v.lang.replace('_', '-') === lang) ||
            voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    }, []);

    // ---------- Português -> inglês ----------
    const translateText = useCallback(async (rawText) => {
        const text = String(rawText || '').trim();
        if (!text || isLoadingRef.current) return;

        isLoadingRef.current = true;
        setIsLoading(true);
        setErrorMessage('');
        setPractice(null);

        try {
            const cfg = appStateRef.current || {};
            const data = await translatePhrase({
                text,
                topic: cfg.topic,
                level: cfg.level,
                provider: cfg.provider
            });

            const english = typeof data.english === 'string' ? data.english.trim() : '';
            if (!english) throw new Error('A IA não retornou a frase em inglês. Tente novamente.');

            const entry = {
                id: newId(),
                original: (typeof data.original === 'string' && data.original.trim()) || text,
                english,
                alternatives: Array.isArray(data.alternatives) ? data.alternatives.filter(alt => alt && alt.en) : [],
                tip: typeof data.tip === 'string' ? data.tip.trim() : ''
            };

            setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
            setActiveId(entry.id);

            if (cfg.autoSpeak !== false) {
                speak(english, { lang: 'en-US' });
            }
        } catch (error) {
            console.error('Erro ao traduzir a frase:', error);
            setErrorMessage(error.message || 'Erro ao gerar a tradução.');
        } finally {
            isLoadingRef.current = false;
            setIsLoading(false);
        }
    }, [speak]);

    // ---------- Treino: compara o que você falou com a frase em inglês ----------
    const evaluateSpeech = useCallback((heard) => {
        const entry = activeEntryRef.current;
        if (!entry) return;
        const { words, score } = compareSpeech(entry.english, heard);
        setPractice({ entryId: entry.id, heard, words, score });
    }, []);

    // ---------- Microfone ----------
    const startListening = useCallback((mode = 'pt') => {
        if (listeningRef.current || isLoadingRef.current) return;
        if (mode === 'en' && !activeEntryRef.current) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMessage('Reconhecimento de voz não suportado neste navegador. Use o Chrome ou o Edge.');
            return;
        }

        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        const recognition = new SpeechRecognition();
        recognition.lang = mode === 'pt' ? 'pt-BR' : 'en-US';
        recognition.continuous = false;
        recognition.interimResults = true;

        let finalTranscript = '';
        let lastInterim = '';
        let failureReason = '';

        recognition.onstart = () => {
            setListening(mode);
            setSpeechStatus(mode === 'pt' ? 'Ouvindo em português...' : 'Ouvindo o seu inglês...');
        };

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }
            if (interim) {
                lastInterim = interim;
                setSpeechStatus(`${mode === 'pt' ? 'Ouvindo' : 'Ouvindo o seu inglês'}... ${interim}`);
            }
        };

        recognition.onerror = (event) => {
            failureReason = event.error || 'unknown';
        };

        // O resultado é tratado no onend: vale tanto ao falar até o fim quanto ao parar com a barra de espaço
        recognition.onend = () => {
            listeningRef.current = null;
            recognitionRef.current = null;
            setListening(null);

            const transcript = (finalTranscript || lastInterim).trim();

            if (transcript) {
                setSpeechStatus('');
                if (mode === 'pt') {
                    translateText(transcript);
                } else {
                    evaluateSpeech(transcript);
                }
                return;
            }

            if (failureReason === 'not-allowed' || failureReason === 'service-not-allowed') {
                setSpeechStatus('');
                setErrorMessage('Permissão do microfone negada. Libere o acesso nas configurações do navegador.');
            } else if (failureReason && failureReason !== 'aborted') {
                setSpeechStatus('Não consegui ouvir. Tente de novo.');
                setTimeout(() => setSpeechStatus(''), 2500);
            } else {
                setSpeechStatus('');
            }
        };

        try {
            listeningRef.current = mode;
            recognitionRef.current = recognition;
            recognition.start();
        } catch (error) {
            console.error('Erro ao iniciar o microfone:', error);
            listeningRef.current = null;
            recognitionRef.current = null;
            setListening(null);
        }
    }, [translateText, evaluateSpeech]);

    const stopListening = useCallback(() => {
        // stop() encerra a captura e ainda entrega o que foi ouvido (dispara onend)
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (error) {
                console.error('Erro ao parar o microfone:', error);
            }
        }
    }, []);

    // Barra de espaço: para o que estiver ouvindo ou começa a gravar em português
    const toggleListening = useCallback(() => {
        if (listeningRef.current) {
            stopListening();
        } else {
            startListening('pt');
        }
    }, [startListening, stopListening]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code !== 'Space' || isTypingTarget(event.target)) return;

            event.preventDefault(); // evita rolar a página
            if (event.repeat) return; // segurar a tecla não deve alternar várias vezes

            // Tira o foco de botões para a barra de espaço não "clicar" neles também
            if (event.target && event.target.tagName === 'BUTTON') event.target.blur();

            toggleListening();
        };

        const handleKeyUp = (event) => {
            if (event.code === 'Space' && !isTypingTarget(event.target)) event.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [toggleListening]);

    // Limpeza ao sair da tela
    useEffect(() => {
        return () => {
            const recognition = recognitionRef.current;
            if (recognition) {
                recognition.onend = null;
                recognition.onresult = null;
                recognition.onerror = null;
                try {
                    recognition.abort();
                } catch {
                    // ignora
                }
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const selectEntry = useCallback((id) => {
        setActiveId(id);
        setPractice(null);
    }, []);

    const clearHistory = useCallback(() => {
        setEntries([]);
        setActiveId(null);
        setPractice(null);
    }, []);

    const clearError = useCallback(() => setErrorMessage(''), []);

    return {
        entries,
        activeEntry,
        isLoading,
        listening,
        speechStatus,
        errorMessage,
        clearError,
        practice: practice && activeEntry && practice.entryId === activeEntry.id ? practice : null,
        speak,
        submitText: translateText,
        startListening,
        stopListening,
        toggleListening,
        selectEntry,
        clearHistory
    };
}