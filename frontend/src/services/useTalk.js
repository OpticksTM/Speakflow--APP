// frontend/src/services/useTalk.js
// Conversa por voz: você toca e fala (português, inglês ou os dois), a IA responde em inglês.
// Também guarda a conversa, cuida do "Repetir" (treino de pronúncia) e do modo mãos livres.

import { useState, useEffect, useRef, useCallback } from 'react';
import { sendChatMessage, sendVoiceMessage, transcribeAudio } from './api';
import { startRecording, isRecordingSupported, blobToBase64 } from './audioRecorder';
import { compareSpeech } from './speechMatch';

const STORAGE_KEY = 'speakflow_talk_v1';
const MAX_SAVED_TURNS = 40;
const MAX_HISTORY_MESSAGES = 20;

// Quanto mais iniciante, mais devagar a IA fala
function rateForLevel(level) {
    const key = String(level || '').toLowerCase();
    if (key.startsWith('inic')) return 0.8;
    if (key.startsWith('avan')) return 1;
    return 0.9;
}

function buildGreeting(persona) {
    const p = String(persona || '').toLowerCase();
    const base = { id: 'greeting', role: 'ai', status: 'done' };

    if (p.includes('sarah')) {
        return {
            ...base,
            text: "Hello! I'm Ms. Sarah, your English teacher. What would you like to practice today?",
            translation: 'Olá! Eu sou a Ms. Sarah, sua professora de inglês. O que você gostaria de praticar hoje?',
            suggestions: [
                { en: 'I want to practice speaking.', pt: 'Quero praticar a fala.' },
                { en: 'Can you help me with my grammar?', pt: 'Você pode me ajudar com a gramática?' }
            ]
        };
    }

    if (p.includes('smith')) {
        return {
            ...base,
            text: "Good morning. I'm Mr. Smith. Shall we begin? Tell me a little about your work.",
            translation: 'Bom dia. Eu sou o Sr. Smith. Vamos começar? Fale um pouco sobre o seu trabalho.',
            suggestions: [
                { en: 'I work in sales.', pt: 'Eu trabalho com vendas.' },
                { en: 'I would like to improve my business English.', pt: 'Eu gostaria de melhorar meu inglês de negócios.' }
            ]
        };
    }

    return {
        ...base,
        text: 'Hi! My name is Alex. Tell me, how is your day going so far?',
        translation: 'Oi! Meu nome é Alex. Me conta, como está indo o seu dia até agora?',
        suggestions: [
            { en: 'My day is going great, and yours?', pt: 'Meu dia está indo ótimo, e o seu?' },
            { en: 'I want to practice my English with you.', pt: 'Quero praticar meu inglês com você.' }
        ]
    };
}

function loadTurns() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(turn => turn && turn.id && turn.role && turn.status === 'done').slice(-MAX_SAVED_TURNS);
    } catch {
        return [];
    }
}

function saveTurns(turns) {
    try {
        const doneTurns = turns.filter(turn => turn.status === 'done').slice(-MAX_SAVED_TURNS);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doneTurns));
    } catch {
        // armazenamento indisponível: segue sem salvar
    }
}

// Histórico enviado à IA: o que você disse (em inglês, quando possível) e o que ela respondeu
function buildHistory(turns) {
    return turns
        .filter(turn => turn.status !== 'pending' && turn.status !== 'error')
        .map(turn => (
            turn.role === 'ai'
                ? { role: 'model', content: turn.text }
                : { role: 'user', content: turn.english || turn.heard }
        ))
        .filter(message => message.content)
        .slice(-MAX_HISTORY_MESSAGES);
}

function micErrorMessage(error) {
    const name = error && error.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Permissão do microfone negada. Libere o acesso nas configurações do navegador.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Nenhum microfone encontrado.';
    if (name === 'NotReadableError') return 'O microfone está em uso por outro aplicativo.';
    return 'Não foi possível acessar o microfone.';
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

export default function useTalk(settings) {
    const [turns, setTurns] = useState(() => {
        const saved = loadTurns();
        return saved.length > 0 ? saved : [buildGreeting(settings && settings.persona)];
    });
    const [phase, setPhaseState] = useState('idle'); // idle | listening | processing | speaking | practicing
    const [level, setLevel] = useState(0);
    const [practice, setPractice] = useState(null); // { turnId, heard, words, score }
    const [errorMessage, setErrorMessage] = useState('');
    const [voiceAvailable] = useState(() => isRecordingSupported());

    // Refs evitam "closures velhos" nos callbacks de áudio, teclado e fala
    const settingsRef = useRef(settings);
    const turnsRef = useRef(turns);
    const phaseRef = useRef('idle');
    const recorderRef = useRef(null);
    const speakTokenRef = useRef(0);
    const unlockedRef = useRef(false);
    const mountedRef = useRef(true);
    const practiceTargetRef = useRef(null);
    const lastLevelRef = useRef(0);
    const lastLevelTimeRef = useRef(0);
    const startListeningRef = useRef(() => {});
    const finishRecordingRef = useRef(() => {});

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        turnsRef.current = turns;
        saveTurns(turns);
    }, [turns]);

    const setPhase = useCallback((next) => {
        phaseRef.current = next;
        setPhaseState(next);
    }, []);

    // ---------- Fala da IA (Text-to-Speech) ----------
    const speak = useCallback((text, options = {}) => {
        const { lang = 'en-US', rate = 0.9, onEnd } = options;
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
            if (onEnd) onEnd();
            return;
        }

        window.speechSynthesis.cancel();
        const token = speakTokenRef.current + 1;
        speakTokenRef.current = token;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = rate;

        const voices = window.speechSynthesis.getVoices();
        const voice =
            voices.find(v => v.lang.replace('_', '-') === lang) ||
            voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
        if (voice) utterance.voice = voice;

        // Só avisa o fim se esta ainda for a fala atual (cancelar uma fala não deve reiniciar o ciclo)
        const done = () => {
            if (speakTokenRef.current === token && onEnd) onEnd();
        };
        utterance.onend = done;
        utterance.onerror = done;

        window.speechSynthesis.speak(utterance);
    }, []);

    const stopSpeaking = useCallback(() => {
        speakTokenRef.current += 1;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        if (phaseRef.current === 'speaking') setPhase('idle');
    }, [setPhase]);

    // iPhone/Safari só libera a voz depois de uma fala iniciada por um toque
    const unlockSpeech = useCallback(() => {
        if (unlockedRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        try {
            const silent = new SpeechSynthesisUtterance('');
            silent.volume = 0;
            window.speechSynthesis.speak(silent);
            unlockedRef.current = true;
        } catch {
            // ignora
        }
    }, []);

    // Fala a resposta da IA e, no modo mãos livres, volta a ouvir sozinho
    const speakReply = useCallback((text) => {
        const cfg = settingsRef.current || {};
        setPhase('speaking');
        speak(text, {
            lang: 'en-US',
            rate: rateForLevel(cfg.level),
            onEnd: () => {
                if (!mountedRef.current) return;
                if (phaseRef.current === 'speaking') setPhase('idle');
                const latest = settingsRef.current || {};
                if (latest.handsFree && phaseRef.current === 'idle') startListeningRef.current('talk');
            }
        });
    }, [speak, setPhase]);

    // ---------- Resultado da IA -> conversa ----------
    const applyResult = useCallback((userTurnId, heard, data) => {
        const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
        if (!reply) throw new Error('A IA não retornou uma resposta. Tente novamente.');

        const userTranslation = typeof data.userTranslation === 'string' ? data.userTranslation.trim() : '';
        const isPortuguese = data.userLanguage === 'pt';

        const userUpdate = isPortuguese
            ? { heard, userLanguage: 'pt', english: userTranslation, portuguese: heard, correction: '' }
            : {
                heard,
                userLanguage: 'en',
                english: heard,
                portuguese: userTranslation,
                correction: typeof data.correction === 'string' ? data.correction.trim() : ''
            };

        const aiTurn = {
            id: newId('ai'),
            role: 'ai',
            text: reply,
            translation: typeof data.translation === 'string' ? data.translation.trim() : '',
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            status: 'done'
        };

        setTurns(prev => [
            ...prev.map(turn => (turn.id === userTurnId ? { ...turn, ...userUpdate, status: 'done' } : turn)),
            aiTurn
        ]);
        setPractice(null);

        const cfg = settingsRef.current || {};
        if (cfg.autoSpeak !== false) {
            speakReply(reply);
        } else {
            setPhase('idle');
        }
    }, [speakReply, setPhase]);

    const handleSendError = useCallback((userTurnId, error) => {
        console.error('Erro na conversa:', error);
        setPhase('idle');

        if (error && error.code === 'NO_SPEECH') {
            setTurns(prev => prev.filter(turn => turn.id !== userTurnId));
            setErrorMessage('Não consegui ouvir. Fale um pouco mais perto do microfone e tente de novo.');
            return;
        }

        const heard = error && error.data && error.data.heard;
        setTurns(prev => prev.map(turn => (
            turn.id === userTurnId ? { ...turn, heard: heard || turn.heard, status: 'error' } : turn
        )));
        setErrorMessage((error && error.message) || 'Erro ao comunicar com a IA.');
    }, [setPhase]);

    // ---------- Texto digitado ----------
    const sendText = useCallback(async (rawText) => {
        const text = String(rawText || '').trim();
        if (!text) return;
        const current = phaseRef.current;
        if (current === 'processing' || current === 'listening' || current === 'practicing') return;

        stopSpeaking();
        setErrorMessage('');
        setPhase('processing');

        const userTurnId = newId('user');
        const history = buildHistory(turnsRef.current);
        setTurns(prev => [...prev, { id: userTurnId, role: 'user', heard: text, status: 'pending' }]);

        try {
            const cfg = settingsRef.current || {};
            const data = await sendChatMessage({
                message: text,
                history,
                persona: cfg.persona,
                topic: cfg.topic,
                level: cfg.level,
                provider: cfg.provider
            });
            applyResult(userTurnId, text, data);
        } catch (error) {
            handleSendError(userTurnId, error);
        }
    }, [applyResult, handleSendError, setPhase, stopSpeaking]);

    // ---------- Voz digitada pelo microfone ----------
    const processVoice = useCallback(async ({ blob, mimeType }) => {
        if (!blob || blob.size < 1) {
            setPhase('idle');
            return;
        }

        setPhase('processing');
        const userTurnId = newId('user');
        const history = buildHistory(turnsRef.current);
        setTurns(prev => [...prev, { id: userTurnId, role: 'user', heard: '', status: 'pending' }]);

        try {
            const audio = await blobToBase64(blob);
            const cfg = settingsRef.current || {};
            const data = await sendVoiceMessage({
                audio,
                mimeType,
                history,
                persona: cfg.persona,
                topic: cfg.topic,
                level: cfg.level,
                provider: cfg.provider
            });
            applyResult(userTurnId, data.heard || '', data);
        } catch (error) {
            handleSendError(userTurnId, error);
        }
    }, [applyResult, handleSendError, setPhase]);

    // ---------- Treino: você repete a frase em inglês ----------
    const processPractice = useCallback(async ({ blob, mimeType }) => {
        const target = practiceTargetRef.current;
        if (!target || !blob || blob.size < 1) {
            setPhase('idle');
            return;
        }

        setPhase('processing');
        try {
            const audio = await blobToBase64(blob);
            const { text } = await transcribeAudio({ audio, mimeType, language: 'en' });
            const { words, score } = compareSpeech(target.english, text);
            setPractice({ turnId: target.id, heard: text, words, score });
        } catch (error) {
            console.error('Erro no treino:', error);
            setErrorMessage(
                error && error.code === 'NO_SPEECH'
                    ? 'Não consegui ouvir sua frase. Tente de novo.'
                    : (error && error.message) || 'Erro ao avaliar a sua fala.'
            );
        } finally {
            setPhase('idle');
        }
    }, [setPhase]);

    // ---------- Gravação ----------
    const handleLevel = useCallback((value) => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastLevelTimeRef.current < 50) return;
        if (Math.abs(value - lastLevelRef.current) < 0.03) return;
        lastLevelTimeRef.current = now;
        lastLevelRef.current = value;
        setLevel(value);
    }, []);

    // Encerra a gravação: "verdict" vem do detector de pausa ('stop' ou 'nospeech'); sem ele foi um toque
    const finishRecording = useCallback(async (verdict) => {
        const recorder = recorderRef.current;
        if (!recorder) return;
        recorderRef.current = null;
        setLevel(0);
        lastLevelRef.current = 0;

        const mode = phaseRef.current;

        if (verdict === 'nospeech') {
            recorder.cancel();
            setPhase('idle');
            setErrorMessage('Não ouvi nada. Toque no microfone e fale de novo.');
            return;
        }

        let recording;
        try {
            recording = await recorder.stop();
        } catch (error) {
            console.error('Erro ao finalizar a gravação:', error);
            setPhase('idle');
            return;
        }

        if (mode === 'practicing') {
            await processPractice(recording);
        } else {
            await processVoice(recording);
        }
    }, [processPractice, processVoice, setPhase]);

    useEffect(() => {
        finishRecordingRef.current = finishRecording;
    }, [finishRecording]);

    const startListening = useCallback(async (mode = 'talk') => {
        const current = phaseRef.current;
        if (current === 'listening' || current === 'processing' || current === 'practicing') return;

        if (typeof window !== 'undefined' && window.isSecureContext === false) {
            setErrorMessage('O microfone só funciona em conexão segura (https) ou em localhost.');
            return;
        }
        if (!isRecordingSupported()) {
            setErrorMessage('Este navegador não consegue gravar áudio. Use o campo de texto.');
            return;
        }

        stopSpeaking();
        unlockSpeech();
        setErrorMessage('');
        setPhase(mode === 'practice' ? 'practicing' : 'listening');

        try {
            recorderRef.current = await startRecording({
                onLevel: handleLevel,
                onAutoStop: (verdict) => finishRecordingRef.current(verdict)
            });
        } catch (error) {
            console.error('Erro ao iniciar a gravação:', error);
            recorderRef.current = null;
            setPhase('idle');
            setErrorMessage(micErrorMessage(error));
        }
    }, [handleLevel, setPhase, stopSpeaking, unlockSpeech]);

    useEffect(() => {
        startListeningRef.current = startListening;
    }, [startListening]);

    // Toque no microfone: começa, envia (se já está ouvindo) ou interrompe a fala da IA e já responde
    const toggleTalk = useCallback(() => {
        const current = phaseRef.current;
        if (current === 'listening' || current === 'practicing') {
            finishRecordingRef.current();
            return;
        }
        if (current === 'processing') return;
        startListening('talk');
    }, [startListening]);

    const practiceTurn = useCallback((turnId) => {
        const turn = turnsRef.current.find(item => item.id === turnId);
        if (!turn || !turn.english) return;
        practiceTargetRef.current = turn;
        startListening('practice');
    }, [startListening]);

    const retryTurn = useCallback((turnId) => {
        const turn = turnsRef.current.find(item => item.id === turnId);
        if (!turn || !turn.heard) return;
        setTurns(prev => prev.filter(item => item.id !== turnId));
        sendText(turn.heard);
    }, [sendText]);

    const clearConversation = useCallback(() => {
        stopSpeaking();
        if (recorderRef.current) {
            recorderRef.current.cancel();
            recorderRef.current = null;
        }
        setPhase('idle');
        setLevel(0);
        setPractice(null);
        setErrorMessage('');
        setTurns([buildGreeting(settingsRef.current && settingsRef.current.persona)]);
    }, [setPhase, stopSpeaking]);

    const replayLast = useCallback(() => {
        const last = [...turnsRef.current].reverse().find(turn => turn.role === 'ai');
        if (!last) return;
        const cfg = settingsRef.current || {};
        speak(last.text, { lang: 'en-US', rate: rateForLevel(cfg.level) });
    }, [speak]);

    const clearError = useCallback(() => setErrorMessage(''), []);

    // ---------- Barra de espaço (computador) ----------
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code !== 'Space' || isTypingTarget(event.target)) return;

            event.preventDefault(); // evita rolar a página
            if (event.repeat) return; // segurar a tecla não deve alternar várias vezes

            // Tira o foco de botões para a barra de espaço não "clicar" neles também
            if (event.target && event.target.tagName === 'BUTTON') event.target.blur();

            toggleTalk();
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
    }, [toggleTalk]);

    // Limpeza ao sair da tela
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            speakTokenRef.current += 1;
            if (recorderRef.current) {
                recorderRef.current.cancel();
                recorderRef.current = null;
            }
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    return {
        turns,
        phase,
        level,
        practice,
        errorMessage,
        clearError,
        voiceAvailable,
        toggleTalk,
        sendText,
        practiceTurn,
        retryTurn,
        clearConversation,
        replayLast,
        stopSpeaking,
        speak
    };
}