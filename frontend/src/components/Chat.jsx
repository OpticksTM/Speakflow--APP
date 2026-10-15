// frontend/src/components/Chat.jsx
import React, { useState, useRef, useEffect } from 'react';
import useChatLogic from '../services/useChatLogic';

/* ------------------------------------------------------------------ */
/* Animações em CSS puro (não exige configuração extra do Tailwind)    */
/* ------------------------------------------------------------------ */
const CHAT_STYLES = `
@keyframes sf-rise {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes sf-wave {
    0%, 100% { transform: scaleY(0.3); }
    50%      { transform: scaleY(1); }
}
@keyframes sf-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.55), 0 0 22px 2px rgba(244, 63, 94, 0.35); }
    50%      { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0), 0 0 36px 6px rgba(244, 63, 94, 0.5); }
}
.sf-rise     { animation: sf-rise 0.35s ease-out both; }
.sf-wave-bar { animation: sf-wave 1s ease-in-out infinite; transform-origin: center; }
.sf-glow     { animation: sf-glow 1.6s ease-in-out infinite; }
.sf-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
.sf-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.sf-scroll::-webkit-scrollbar-track { background: transparent; }
.sf-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
    .sf-rise, .sf-wave-bar, .sf-glow { animation: none; }
}
`;

const FONT_STACK = "Inter, Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #1FA9E0, #3CCFC0)'; // ciano -> verde-água (a onda e o ponto do logo)
const GRADIENT_BUBBLE = 'linear-gradient(135deg, #1B5FA8, #1384BE)'; // azul-marinho -> azul (balão de quem fala, texto branco legível)
const GRADIENT_ROSE = 'linear-gradient(135deg, #e11d48, #f43f5e)';
const GRADIENT_ACCENT = 'linear-gradient(135deg, #1D6FD0, #2DC5F4)'; // azul -> ciano (botões e seleções)

/* ------------------------------------------------------------------ */
/* Ícones SVG minimalistas (sem biblioteca externa)                    */
/* ------------------------------------------------------------------ */
function Svg({ className = 'w-4 h-4', children, strokeWidth = 1.8 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

function IconSpeaker({ className }) {
    return (
        <Svg className={className}>
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </Svg>
    );
}

function IconTranslate({ className }) {
    return (
        <Svg className={className}>
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
        </Svg>
    );
}

function IconMic({ className }) {
    return (
        <Svg className={className}>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
        </Svg>
    );
}

function IconSend({ className }) {
    return (
        <Svg className={className}>
            <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
            <path d="M6 12h16" />
        </Svg>
    );
}

function IconSpark({ className }) {
    return (
        <Svg className={className}>
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            <path d="M19 16v4" />
            <path d="M17 18h4" />
        </Svg>
    );
}

function IconClose({ className }) {
    return (
        <Svg className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </Svg>
    );
}

/* ------------------------------------------------------------------ */
/* Rótulos amigáveis para persona, tópico e nível                      */
/* ------------------------------------------------------------------ */
function getPersona(persona) {
    const p = String(persona || '').toLowerCase();
    if (p.includes('sarah')) return { name: 'Ms. Sarah', role: 'Professora de inglês', initial: 'S' };
    if (p.includes('smith')) return { name: 'Mr. Smith', role: 'Executivo de negócios', initial: 'S' };
    return { name: 'Alex', role: 'Amigo casual', initial: 'A' };
}

const TOPIC_LABELS = {
    'diário': 'Dia a dia',
    'diario': 'Dia a dia',
    'viagem': 'Viagem',
    'trabalho': 'Trabalho'
};

const LEVEL_LABELS = {
    'iniciante': 'Iniciante',
    'intermediário': 'Intermediário',
    'intermediario': 'Intermediário',
    'avançado': 'Avançado',
    'avancado': 'Avançado'
};

const LEVEL_BADGE_CLASSES = {
    'iniciante': 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    'intermediário': 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    'intermediario': 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    'avançado': 'text-rose-300 bg-rose-400/10 border-rose-400/20',
    'avancado': 'text-rose-300 bg-rose-400/10 border-rose-400/20'
};

/* ------------------------------------------------------------------ */
/* Pequenos componentes visuais                                        */
/* ------------------------------------------------------------------ */
function Avatar({ initial, size = 'md' }) {
    const sizeClasses = size === 'lg' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-[11px]';
    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-full border border-white/15 font-semibold text-white shadow-md ${sizeClasses}`}
            style={{ background: GRADIENT_ACCENT }}
        >
            {initial}
        </div>
    );
}

function TypingDots({ tone = 'text-slate-400' }) {
    return (
        <div className={`flex items-center gap-1.5 ${tone}`} aria-label="Carregando">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
        </div>
    );
}

function ActionButton({ onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */
export default function Chat({ appState, onExit, onSwitchMode }) {
    const {
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
    } = useChatLogic(appState);

    const [inputText, setInputText] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim() || isThinking) return;
        sendMessage(inputText);
        setInputText('');
    };

    const lastAiMessage = [...messages].reverse().find(m => m.sender === 'ai');
    const currentSuggestions = isThinking ? [] : (lastAiMessage?.suggestions || []);

    const persona = getPersona(appState.persona);
    const topicKey = String(appState.topic || '').toLowerCase();
    const levelKey = String(appState.level || '').toLowerCase();
    const topicLabel = TOPIC_LABELS[topicKey] || appState.topic || 'Geral';
    const levelLabel = LEVEL_LABELS[levelKey] || appState.level || 'Iniciante';
    const levelBadgeClasses = LEVEL_BADGE_CLASSES[levelKey] || 'text-amber-300 bg-amber-400/10 border-amber-400/20';

    return (
        <>
            <style>{CHAT_STYLES}</style>

            {/* Fundo premium: gradiente escuro, malha de pontos e brilhos suaves */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #040B18 0%, #0A1B33 50%, #0E2644 100%)' }}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px)',
                        backgroundSize: '26px 26px',
                        WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 78%)',
                        maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 78%)'
                    }}
                />
                <div
                    className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(45, 197, 244, 0.18), transparent 65%)' }}
                />
                <div
                    className="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(44, 140, 220, 0.18), transparent 65%)' }}
                />
            </div>

            {/* Card central de vidro */}
            <div
                className="relative z-10 mx-auto flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md"
                style={{ fontFamily: FONT_STACK }}
            >
                {/* Linha de brilho no topo do vidro */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }}
                />

                {/* Cabeçalho */}
                <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-7">
                    <div className="flex items-center gap-3.5">
                        <div className="relative">
                            <Avatar initial={persona.initial} size="lg" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-cyan-400" />
                        </div>
                        <div className="leading-tight">
                            <h2 className="text-[15px] font-semibold tracking-tight text-white">{persona.name}</h2>
                            <p className="mt-0.5 text-xs text-slate-400">{persona.role}</p>
                        </div>
                        <div className="ml-1 hidden items-center gap-2 sm:flex">
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                                {topicLabel}
                            </span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${levelBadgeClasses}`}>
                                {levelLabel}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onSwitchMode && (
                            <button
                                type="button"
                                onClick={onSwitchMode}
                                className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                            >
                                Frase rápida
                            </button>
                        )}
                        {onExit && (
                            <button
                                type="button"
                                onClick={onExit}
                                className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                            >
                                Sair
                            </button>
                        )}
                    </div>
                </header>

                {/* Mensagens */}
                <div className="sf-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 sm:px-8">
                    {messages.map((msg) => {
                        const isUser = msg.sender === 'user';
                        const isPending = msg.status === 'pending';
                        const isError = msg.status === 'error';
                        const showActions = !isPending && !isError;

                        return (
                            <div
                                key={msg.id}
                                className={`sf-rise flex w-full items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                {!isUser && <Avatar initial={persona.initial} />}

                                <div className={`group flex max-w-[82%] flex-col sm:max-w-[72%] ${isUser ? 'items-end' : 'items-start'}`}>
                                    <div
                                        className={`rounded-2xl border px-4 py-3 transition-all duration-200 ${
                                            isUser
                                                ? 'border-white/15 shadow-lg shadow-cyan-950/40 hover:shadow-cyan-900/50'
                                                : 'border-white/10 bg-white/5 hover:bg-white/[0.08]'
                                        } ${isError ? 'opacity-70' : ''}`}
                                        style={isUser ? { background: GRADIENT_BUBBLE } : undefined}
                                    >
                                        <p className="text-[15px] font-medium leading-relaxed text-white">{msg.text}</p>

                                        {isPending && (
                                            <div className="mt-3 border-t border-white/20 pt-3">
                                                <TypingDots tone="text-cyan-100" />
                                            </div>
                                        )}

                                        {isError && (
                                            <p className="mt-3 border-t border-white/20 pt-3 text-xs text-rose-100">
                                                Mensagem não enviada. Tente novamente.
                                            </p>
                                        )}

                                        {!isPending && !isError && msg.translation && (
                                            <p
                                                className={`mt-3 border-t pt-3 text-sm italic leading-relaxed ${
                                                    isUser ? 'border-white/20 text-cyan-50/85' : 'border-white/10 text-slate-400'
                                                }`}
                                            >
                                                {msg.translation}
                                            </p>
                                        )}
                                    </div>

                                    {showActions && (
                                        <div
                                            className={`mt-1.5 flex gap-1.5 opacity-100 transition-opacity duration-200 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 ${
                                                isUser ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            <ActionButton
                                                label="Ouvir"
                                                onClick={() => speakText(msg.text, msg.lang || 'en-US')}
                                            >
                                                <IconSpeaker className="h-3.5 w-3.5" />
                                            </ActionButton>
                                            {msg.translation && (
                                                <ActionButton
                                                    label="Ouvir tradução"
                                                    onClick={() => speakText(msg.translation, msg.translationLang || 'pt-BR')}
                                                >
                                                    <IconTranslate className="h-3.5 w-3.5" />
                                                </ActionButton>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {isThinking && (
                        <div className="sf-rise flex w-full items-end justify-start gap-2.5">
                            <Avatar initial={persona.initial} />
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
                                <TypingDots />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Erro visível */}
                {errorMessage && (
                    <div className="flex items-center justify-between gap-3 border-t border-rose-500/20 bg-rose-500/10 px-5 py-2.5 text-xs text-rose-200 sm:px-8">
                        <span>{errorMessage}</span>
                        <button
                            type="button"
                            onClick={clearError}
                            aria-label="Fechar aviso"
                            className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-rose-300 transition-colors hover:bg-rose-500/20 hover:text-white"
                        >
                            <IconClose className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {/* Status do microfone */}
                {speechStatus && (
                    <div className="flex items-center justify-center gap-2 border-t border-cyan-400/10 bg-cyan-400/[0.06] py-2 text-xs text-cyan-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                        {speechStatus}
                    </div>
                )}

                {/* Sugestões */}
                {currentSuggestions.length > 0 && (
                    <div className="border-t border-white/10 bg-black/10 px-5 pb-2 pt-3.5 sm:px-8">
                        <div className="mb-2.5 flex items-center justify-between text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1.5">
                                <IconSpark className="h-3.5 w-3.5 text-sky-300" />
                                Sugestões do que você pode falar
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowSuggestions(!showSuggestions)}
                                className="cursor-pointer text-sky-300 transition-colors hover:text-sky-200"
                            >
                                {showSuggestions ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>
                        {showSuggestions && (
                            <div className="sf-scroll flex gap-3 overflow-x-auto px-0.5 pb-3 pt-1">
                                {currentSuggestions.map((sug, idx) => (
                                    <button
                                        key={`${lastAiMessage.id}-${idx}`}
                                        type="button"
                                        onClick={() => sendMessage(sug.en || sug.pt)}
                                        className="group relative min-w-[220px] max-w-[300px] shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-sky-400/40 hover:bg-white/[0.07] hover:shadow-[0_12px_30px_-12px_rgba(44,140,220,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                            style={{ background: 'radial-gradient(120% 120% at 0% 0%, rgba(44, 140, 220, 0.2), transparent 60%)' }}
                                        />
                                        <span className="relative block text-[13px] font-semibold leading-snug text-slate-100">{sug.en}</span>
                                        {sug.pt && (
                                            <span className="relative mt-1.5 block text-[11px] italic leading-snug text-slate-400">{sug.pt}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Barra de entrada */}
                <div className="border-t border-white/10 bg-black/20 px-4 pb-3 pt-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        {/* Botão de gravar com glow e ondas */}
                        <div className="relative shrink-0">
                            {isRecording && (
                                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
                            )}
                            <button
                                type="button"
                                onClick={isRecording ? stopListening : startListening}
                                disabled={isThinking && !isRecording}
                                aria-label={isRecording ? 'Parar gravação' : 'Gravar'}
                                className={`relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 text-xs font-semibold uppercase tracking-wide text-white transition-all duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isRecording ? 'sf-glow' : 'shadow-lg shadow-cyan-950/40'
                                }`}
                                style={{ background: isRecording ? GRADIENT_ROSE : GRADIENT_PRIMARY }}
                            >
                                {isRecording ? (
                                    <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
                                        {[0, 1, 2, 3, 4].map((i) => (
                                            <span
                                                key={i}
                                                className="sf-wave-bar block h-4 w-[3px] rounded-full bg-white"
                                                style={{ animationDelay: `${i * 120}ms` }}
                                            />
                                        ))}
                                    </span>
                                ) : (
                                    <IconMic className="h-4 w-4" />
                                )}
                                {isRecording ? 'Parar' : 'Gravar'}
                            </button>
                        </div>

                        {/* Idioma do microfone */}
                        <div className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold">
                            <button
                                type="button"
                                onClick={() => setRecognitionLang('pt-BR')}
                                disabled={isRecording}
                                title="Falar em português"
                                className={`cursor-pointer rounded-full px-3 py-2 transition-all duration-200 disabled:cursor-not-allowed ${
                                    recognitionLang === 'pt-BR' ? 'text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                                style={recognitionLang === 'pt-BR' ? { background: GRADIENT_ACCENT } : undefined}
                            >
                                PT
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecognitionLang('en-US')}
                                disabled={isRecording}
                                title="Falar em inglês"
                                className={`cursor-pointer rounded-full px-3 py-2 transition-all duration-200 disabled:cursor-not-allowed ${
                                    recognitionLang === 'en-US' ? 'text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                                style={recognitionLang === 'en-US' ? { background: GRADIENT_ACCENT } : undefined}
                            >
                                EN
                            </button>
                        </div>

                        {/* Campo de texto com anel de foco animado */}
                        <form
                            onSubmit={handleSend}
                            className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-5 pr-1.5 transition-all duration-200 focus-within:border-sky-400/60 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-sky-500/40"
                        >
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Digite em inglês ou português..."
                                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || isThinking}
                                aria-label="Enviar"
                                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100"
                                style={{ background: GRADIENT_ACCENT }}
                            >
                                <IconSend className="h-4 w-4" />
                            </button>
                        </form>
                    </div>

                    <p className="mt-2.5 text-center text-[11px] text-slate-500">
                        Pressione{' '}
                        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            Espaço
                        </kbd>{' '}
                        para gravar ou parar o microfone
                    </p>
                </div>
            </div>
        </>
    );
}