// frontend/src/components/Quick.jsx
// Modo "Frase rápida": fale em português, receba a frase em inglês e treine repetindo.
import React, { useState } from 'react';
import useQuickPhrase from '../services/useQuickPhrase';

/* ------------------------------------------------------------------ */
/* Animações em CSS puro (não exige configuração extra do Tailwind)    */
/* ------------------------------------------------------------------ */
const QUICK_STYLES = `
@keyframes sq-rise {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes sq-wave {
    0%, 100% { transform: scaleY(0.3); }
    50%      { transform: scaleY(1); }
}
@keyframes sq-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.55), 0 0 22px 2px rgba(244, 63, 94, 0.35); }
    50%      { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0), 0 0 36px 6px rgba(244, 63, 94, 0.5); }
}
.sq-rise     { animation: sq-rise 0.35s ease-out both; }
.sq-wave-bar { animation: sq-wave 1s ease-in-out infinite; transform-origin: center; }
.sq-glow     { animation: sq-glow 1.6s ease-in-out infinite; }
.sq-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
.sq-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.sq-scroll::-webkit-scrollbar-track { background: transparent; }
.sq-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
    .sq-rise, .sq-wave-bar, .sq-glow { animation: none; }
}
`;

const FONT_STACK = "Inter, Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #1FA9E0, #3CCFC0)'; // ciano -> verde-água (a onda e o ponto do logo)
const GRADIENT_ROSE = 'linear-gradient(135deg, #e11d48, #f43f5e)';
const GRADIENT_ACCENT = 'linear-gradient(135deg, #1D6FD0, #2DC5F4)'; // azul -> ciano (botões e seleções)

const EXAMPLES = [
    'Pode baixar o volume, por favor?',
    'Preciso remarcar a entrega para amanhã.',
    'Você sabe como ligar essa máquina de lavar?',
    'Estou procurando o corredor de produtos de limpeza.'
];

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

function IconSlow({ className }) {
    return (
        <Svg className={className}>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2 2" />
            <path d="M9 2h6" />
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
/* Rótulos amigáveis                                                   */
/* ------------------------------------------------------------------ */
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

function scoreStyle(score) {
    if (score >= 90) return { label: 'Excelente!', classes: 'text-teal-300 bg-teal-400/10 border-teal-400/30' };
    if (score >= 70) return { label: 'Quase lá', classes: 'text-amber-300 bg-amber-400/10 border-amber-400/30' };
    return { label: 'Tente de novo', classes: 'text-rose-300 bg-rose-400/10 border-rose-400/30' };
}

/* ------------------------------------------------------------------ */
/* Pequenos componentes visuais                                        */
/* ------------------------------------------------------------------ */
function PillButton({ onClick, disabled, active, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                    ? 'sq-glow border-white/15 text-white'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
            }`}
            style={active ? { background: GRADIENT_ROSE } : undefined}
        >
            {children}
            {label}
        </button>
    );
}

function IconCircleButton({ onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */
export default function Quick({ appState, onExit, onSwitchMode }) {
    const {
        entries,
        activeEntry,
        isLoading,
        listening,
        speechStatus,
        errorMessage,
        clearError,
        practice,
        speak,
        submitText,
        startListening,
        stopListening,
        selectEntry,
        clearHistory
    } = useQuickPhrase(appState);

    const [inputText, setInputText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim() || isLoading) return;
        submitText(inputText);
        setInputText('');
    };

    const topicKey = String(appState.topic || '').toLowerCase();
    const levelKey = String(appState.level || '').toLowerCase();
    const topicLabel = TOPIC_LABELS[topicKey] || appState.topic || 'Geral';
    const levelLabel = LEVEL_LABELS[levelKey] || appState.level || 'Iniciante';
    const levelBadgeClasses = LEVEL_BADGE_CLASSES[levelKey] || 'text-amber-300 bg-amber-400/10 border-amber-400/20';

    const isListeningPt = listening === 'pt';
    const isListeningEn = listening === 'en';
    const isListening = Boolean(listening);
    const recentEntries = entries.slice(0, 8);
    const feedback = practice ? scoreStyle(practice.score) : null;

    return (
        <>
            <style>{QUICK_STYLES}</style>

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
                className="relative z-10 mx-auto flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-slate-100 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md"
                style={{ fontFamily: FONT_STACK }}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }}
                />

                {/* Cabeçalho */}
                <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-7">
                    <div className="flex items-center gap-3.5">
                        <div className="leading-tight">
                            <h2 className="text-[15px] font-semibold tracking-tight text-white">Frase rápida</h2>
                            <p className="mt-0.5 text-xs text-slate-400">Fale em português, treine em inglês</p>
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
                                Conversa
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

                {/* Conteúdo */}
                <div className="sq-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 sm:px-8">
                    {/* Estado vazio */}
                    {!activeEntry && !isLoading && (
                        <div className="sq-rise flex flex-1 flex-col items-center justify-center gap-6 text-center">
                            <div>
                                <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                    O que você quer dizer?
                                </h3>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                                    Aperte <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">Espaço</kbd> e
                                    fale em português. Eu devolvo a frase em inglês para você ouvir e repetir.
                                </p>
                            </div>
                            <div className="flex w-full max-w-lg flex-col gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Experimente</span>
                                {EXAMPLES.map((example) => (
                                    <button
                                        key={example}
                                        type="button"
                                        onClick={() => submitText(example)}
                                        className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Carregando */}
                    {isLoading && (
                        <div className="sq-rise animate-pulse rounded-2xl border border-white/10 bg-white/5 p-6" aria-label="Carregando">
                            <div className="h-3 w-24 rounded-full bg-white/10" />
                            <div className="mt-4 h-7 w-4/5 rounded-lg bg-white/10" />
                            <div className="mt-3 h-7 w-2/5 rounded-lg bg-white/10" />
                            <div className="mt-6 flex gap-2">
                                <div className="h-10 w-24 rounded-full bg-white/10" />
                                <div className="h-10 w-28 rounded-full bg-white/10" />
                                <div className="h-10 w-28 rounded-full bg-white/10" />
                            </div>
                        </div>
                    )}

                    {/* Frase ativa */}
                    {activeEntry && !isLoading && (
                        <div key={activeEntry.id} className="sq-rise flex flex-col gap-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Você disse</span>
                                <p className="mt-1 text-sm italic leading-relaxed text-slate-400">{activeEntry.original}</p>

                                <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-cyan-300/80">Diga em inglês</span>
                                <p className="mt-1.5 text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
                                    {practice
                                        ? practice.words.map((item, index) => (
                                            <span
                                                key={`${item.word}-${index}`}
                                                className={item.ok ? 'text-teal-300' : 'text-rose-300 underline decoration-rose-400/60 decoration-dotted underline-offset-4'}
                                            >
                                                {item.word}{' '}
                                            </span>
                                        ))
                                        : activeEntry.english}
                                </p>

                                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                                    <PillButton onClick={() => speak(activeEntry.english, { lang: 'en-US', rate: 0.9 })} label="Ouvir">
                                        <IconSpeaker className="h-4 w-4" />
                                    </PillButton>
                                    <PillButton onClick={() => speak(activeEntry.english, { lang: 'en-US', rate: 0.55 })} label="Devagar">
                                        <IconSlow className="h-4 w-4" />
                                    </PillButton>
                                    <PillButton
                                        onClick={isListeningEn ? stopListening : () => startListening('en')}
                                        disabled={isLoading || isListeningPt}
                                        active={isListeningEn}
                                        label={isListeningEn ? 'Parar' : 'Repetir'}
                                    >
                                        <IconMic className="h-4 w-4" />
                                    </PillButton>
                                </div>

                                {practice && feedback && (
                                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${feedback.classes}`}>
                                            {practice.score}% · {feedback.label}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            Eu ouvi: <span className="italic text-slate-300">{practice.heard}</span>
                                        </span>
                                    </div>
                                )}

                                {activeEntry.tip && (
                                    <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
                                        <IconSpark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
                                        {activeEntry.tip}
                                    </p>
                                )}
                            </div>

                            {/* Outras formas de dizer */}
                            {activeEntry.alternatives && activeEntry.alternatives.length > 0 && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {activeEntry.alternatives.map((alt) => (
                                        <div
                                            key={alt.label}
                                            className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-all duration-200 hover:border-sky-400/40 hover:bg-white/[0.07]"
                                        >
                                            <div>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">{alt.label}</span>
                                                <p className="mt-1 text-sm font-medium leading-snug text-slate-100">{alt.en}</p>
                                            </div>
                                            <IconCircleButton
                                                label={`Ouvir versão ${alt.label.toLowerCase()}`}
                                                onClick={() => speak(alt.en, { lang: 'en-US', rate: 0.9 })}
                                            >
                                                <IconSpeaker className="h-3.5 w-3.5" />
                                            </IconCircleButton>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recentes */}
                    {entries.length > 1 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold uppercase tracking-wider">Recentes</span>
                                <button
                                    type="button"
                                    onClick={clearHistory}
                                    className="cursor-pointer text-slate-500 transition-colors hover:text-rose-300"
                                >
                                    Limpar
                                </button>
                            </div>
                            {recentEntries.map((item) => {
                                const isActive = activeEntry && item.id === activeEntry.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => selectEntry(item.id)}
                                        className={`cursor-pointer rounded-xl border px-4 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                                            isActive
                                                ? 'border-sky-400/40 bg-white/[0.07]'
                                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        <span className="block truncate text-sm font-medium text-slate-200">{item.english}</span>
                                        <span className="block truncate text-xs italic text-slate-500">{item.original}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
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

                {/* Barra de entrada */}
                <div className="border-t border-white/10 bg-black/20 px-4 pb-3 pt-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            {isListening && (
                                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
                            )}
                            <button
                                type="button"
                                onClick={isListening ? stopListening : () => startListening('pt')}
                                disabled={isLoading}
                                aria-label={isListening ? 'Parar gravação' : 'Gravar em português'}
                                className={`relative inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full border border-white/15 px-6 text-xs font-semibold uppercase tracking-wide text-white transition-all duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isListening ? 'sq-glow' : 'shadow-lg shadow-cyan-950/40'
                                }`}
                                style={{ background: isListening ? GRADIENT_ROSE : GRADIENT_PRIMARY }}
                            >
                                {isListening ? (
                                    <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
                                        {[0, 1, 2, 3, 4].map((i) => (
                                            <span
                                                key={i}
                                                className="sq-wave-bar block h-4 w-[3px] rounded-full bg-white"
                                                style={{ animationDelay: `${i * 120}ms` }}
                                            />
                                        ))}
                                    </span>
                                ) : (
                                    <IconMic className="h-4 w-4" />
                                )}
                                {isListening ? 'Parar' : 'Falar'}
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-5 pr-1.5 transition-all duration-200 focus-within:border-sky-400/60 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-sky-500/40"
                        >
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Ou digite em português..."
                                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || isLoading}
                                aria-label="Traduzir"
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
                        para falar em português
                    </p>
                </div>
            </div>
        </>
    );
}