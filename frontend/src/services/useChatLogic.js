// frontend/src/services/useChatLogic.js

import { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage } from './api';

// ---------- Saudação inicial por persona ----------
function buildGreeting(persona) {
    const p = String(persona || '').toLowerCase();

    if (p.includes('sarah')) {
        return {
            id: 'init-1',
            sender: 'ai',
            text: "Hello! I'm Ms. Sarah, your English teacher. What would you like to practice today?",
            translation: 'Olá! Eu sou a Ms. Sarah, sua professora de inglês. O que você gostaria de praticar hoje?',
            lang: 'en-US',
            translationLang: 'pt-BR',
            status: 'done',
            suggestions: [
                { en: 'I want to practice speaking.', pt: 'Quero praticar a fala.' },
                { en: 'Can you help me with my grammar?', pt: 'Você pode me ajudar com a gramática?' }
            ]
        };
    }

    if (p.includes('smith')) {
        return {
            id: 'init-1',
            sender: 'ai',
            text: "Good morning. I'm Mr. Smith. Shall we begin? Tell me a little about your work.",
            translation: 'Bom dia. Eu sou o Sr. Smith. Vamos começar? Fale um pouco sobre o seu trabalho.',
            lang: 'en-US',
            translationLang: 'pt-BR',
            status: 'done',
            suggestions: [
                { en: 'I work in sales.', pt: 'Eu trabalho com vendas.' },
                { en: 'I would like to improve my business English.', pt: 'Eu gostaria de melhorar meu inglês de negócios.' }
            ]
        };
    }

    return {
        id: 'init-1',
        sender: 'ai',
        text: 'Hello! My name is Alex. How is your day going so far?',
        translation: 'Olá! Meu nome é Alex. Como está indo o seu dia até agora?',
        lang: 'en-US',
        translationLang: 'pt-BR',
        status: 'done',
        suggestions: [
            { en: 'Hi Alex! My day is going great, how about yours?', pt: 'Oi Alex! Meu dia está indo ótimo, e o seu?' },
            { en: 'Hey! I want to practice my English with you today.', pt: 'Ei! Quero praticar meu inglês com você hoje.' }
        ]
    };
}

// ---------- Palpite de idioma (só usado enquanto o servidor não respondeu) ----------
const PT_HINT = /[áéíóúãõçàâêô]|\b(oi|olá|ola|tudo|bem|você|voce|vc|não|nao|sim|obrigado|obrigada|eu|meu|minha|quero|gosto|estou|está|esta|fui|vou|tenho|muito|bom|boa|dia|tarde|noite|hoje|como|que|uma|para|com|mas|então|entao|porque|também|tambem)\b/i;

function guessLanguage(text) {
    return PT_HINT.test(String(text || '')) ? 'pt-BR' : 'en-US';
}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let idCounter = 0;
function newId(prefix) {
    idCounter += 1;
    return `${prefix}-${Date.now()}-${idCounter}`;
}

export default function useChatLogic(appState) {
    const [messages, setMessages] = useState(() => [buildGreeting(appState && appState.persona)]);
    const [isRecording, setIsRecording] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [speechStatus, setSpeechStatus] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [recognitionLang, setRecognitionLangState] = useState('pt-BR');

    // Refs evitam "closures velhos": callbacks do microfone e do teclado sempre enxergam o estado atual
    const messagesRef = useRef(messages);
    const appStateRef = useRef(appState);
    const isThinkingRef = useRef(false);
    const isRecordingRef = useRef(false);
    const recognitionRef = useRef(null);
    const recognitionLangRef = useRef('pt-BR');

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        appStateRef.current = appState;
    }, [appState]);

    // ---------- Fala (Text-to-Speech) ----------
    const speakText = useCallback((text, lang = 'en-US') => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;

        const voices = window.speechSynthesis.getVoices();
        const voice =
            voices.find(v => v.lang.replace('_', '-') === lang) ||
            voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
        if (voice) utterance.voice = voice;

        window.speechSynthesis.speak(utterance);
    }, []);

    // ---------- Envio da mensagem ----------
    const sendMessage = useCallback(async (rawText) => {
        const text = String(rawText || '').trim();
        if (!text || isThinkingRef.current) return;

        isThinkingRef.current = true;
        setIsThinking(true);
        setErrorMessage('');

        const guessedLang = guessLanguage(text);
        const userMessageId = newId('user');

        // Histórico montado ANTES de inserir a mensagem atual (ela vai separada em "message").
        // Balões pendentes ou com erro ficam de fora, e o texto exibido (em inglês) é o que a IA vê.
        const history = messagesRef.current
            .filter(m => m.text && m.status !== 'pending' && m.status !== 'error')
            .map(m => ({ role: m.sender === 'user' ? 'user' : 'model', content: m.text }));

        // Balão provisório: mostra o que o usuário disse, sem texto de "Traduzindo..."
        setMessages(prev => [
            ...prev,
            {
                id: userMessageId,
                sender: 'user',
                text,
                translation: '',
                lang: guessedLang,
                translationLang: guessedLang === 'pt-BR' ? 'en-US' : 'pt-BR',
                status: 'pending'
            }
        ]);

        try {
            const cfg = appStateRef.current || {};
            const data = await sendChatMessage({
                message: text,
                history,
                persona: cfg.persona,
                topic: cfg.topic,
                level: cfg.level,
                provider: cfg.provider
            });

            // JSON puro na raiz: { userLanguage, userTranslation, reply, translation, suggestions }
            const aiText = typeof data.reply === 'string' ? data.reply.trim() : '';
            if (!aiText) throw new Error('A IA não retornou uma resposta. Tente novamente.');

            const aiTranslation = typeof data.translation === 'string' ? data.translation.trim() : '';
            const userTranslation = typeof data.userTranslation === 'string' ? data.userTranslation.trim() : '';
            const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

            // Idioma que o usuário realmente usou (o servidor tem a palavra final)
            const userLang =
                data.userLanguage === 'pt' ? 'pt-BR' : data.userLanguage === 'en' ? 'en-US' : guessedLang;

            setMessages(prev => {
                const updated = prev.map(msg => {
                    if (msg.id !== userMessageId) return msg;

                    if (userLang === 'pt-BR') {
                        // Falou/digitou em português: inglês no topo, português original embaixo
                        if (userTranslation) {
                            return {
                                ...msg,
                                text: userTranslation,
                                translation: text,
                                lang: 'en-US',
                                translationLang: 'pt-BR',
                                status: 'done'
                            };
                        }
                        // Sem tradução disponível: mantém o original, sem linha de tradução
                        return { ...msg, text, translation: '', lang: 'pt-BR', translationLang: '', status: 'done' };
                    }

                    // Falou/digitou em inglês: inglês no topo, tradução em português embaixo
                    return {
                        ...msg,
                        text,
                        translation: userTranslation,
                        lang: 'en-US',
                        translationLang: 'pt-BR',
                        status: 'done'
                    };
                });

                return [
                    ...updated,
                    {
                        id: newId('ai'),
                        sender: 'ai',
                        text: aiText,
                        translation: aiTranslation,
                        suggestions,
                        lang: 'en-US',
                        translationLang: 'pt-BR',
                        status: 'done'
                    }
                ];
            });

            if (cfg.autoSpeak) {
                speakText(aiText, 'en-US');
            }
        } catch (error) {
            console.error('Erro de comunicação com a API:', error);
            // Destrava o balão: remove o estado pendente e avisa o usuário
            setMessages(prev =>
                prev.map(msg => (msg.id === userMessageId ? { ...msg, status: 'error' } : msg))
            );
            setErrorMessage(error.message || 'Erro ao comunicar com a IA.');
        } finally {
            isThinkingRef.current = false;
            setIsThinking(false);
        }
    }, [speakText]);

    // ---------- Microfone (Web Speech API) ----------
    const startListening = useCallback(() => {
        if (isRecordingRef.current || isThinkingRef.current) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMessage('Reconhecimento de voz não suportado neste navegador. Use o Chrome ou o Edge.');
            return;
        }

        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        const recognition = new SpeechRecognition();
        recognition.lang = recognitionLangRef.current;
        recognition.continuous = false;
        recognition.interimResults = true;

        let finalTranscript = '';
        let lastInterim = '';
        let failureReason = '';

        recognition.onstart = () => {
            setIsRecording(true);
            setSpeechStatus('Ouvindo...');
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
                setSpeechStatus(`Ouvindo... ${interim}`);
            }
        };

        recognition.onerror = (event) => {
            failureReason = event.error || 'unknown';
        };

        // O envio acontece no onend: funciona tanto quando você fala até o fim quanto ao parar com a barra de espaço
        recognition.onend = () => {
            isRecordingRef.current = false;
            recognitionRef.current = null;
            setIsRecording(false);

            const transcript = (finalTranscript || lastInterim).trim();

            if (transcript) {
                setSpeechStatus('');
                sendMessage(transcript);
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
            isRecordingRef.current = true;
            recognitionRef.current = recognition;
            recognition.start();
        } catch (error) {
            console.error('Erro ao iniciar o microfone:', error);
            isRecordingRef.current = false;
            recognitionRef.current = null;
            setIsRecording(false);
        }
    }, [sendMessage]);

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

    const setRecognitionLang = useCallback((lang) => {
        recognitionLangRef.current = lang;
        setRecognitionLangState(lang);
    }, []);

    const clearError = useCallback(() => setErrorMessage(''), []);

    // ---------- Barra de espaço liga/desliga o microfone ----------
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code !== 'Space' || isTypingTarget(event.target)) return;

            event.preventDefault(); // evita rolar a página
            if (event.repeat) return; // segurar a tecla não deve alternar várias vezes

            // Tira o foco de botões para a barra de espaço não "clicar" neles também
            if (event.target && event.target.tagName === 'BUTTON') event.target.blur();

            if (isRecordingRef.current) {
                stopListening();
            } else {
                startListening();
            }
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
    }, [startListening, stopListening]);

    // Limpeza ao sair da tela de chat
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

    return {
        messages,
        isRecording,
        isThinking,
        speechStatus,
        errorMessage,
        clearError,
        recognitionLang,
        setRecognitionLang,
        startListening,
        stopListening,
        sendMessage,
        speakText
    };
}