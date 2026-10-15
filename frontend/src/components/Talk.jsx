// frontend/src/components/Talk.jsx
// Tela principal: toque no microfone e fale em português ou inglês. A IA responde em inglês.
import React, { useState, useRef, useEffect } from 'react';
import useTalk from '../services/useTalk';

/* ------------------------------------------------------------------ */
/* Animações em CSS puro (não exige configuração extra do Tailwind)    */
/* ------------------------------------------------------------------ */
const TALK_STYLES = `
@keyframes st-rise {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes st-wave {
    0%, 100% { transform: scaleY(0.3); }
    50%      { transform: scaleY(1); }
}
@keyframes st-breathe {
    0%, 100% { box-shadow: 0 0 0 0 rgba(45, 197, 244, 0.35), 0 10px 30px -8px rgba(45, 197, 244, 0.45); }
    50%      { box-shadow: 0 0 0 14px rgba(45, 197, 244, 0), 0 10px 40px -8px rgba(45, 197, 244, 0.6); }
}
.st-rise     { animation: st-rise 0.35s ease-out both; }
.st-wave-bar { animation: st-wave 1s ease-in-out infinite; transform-origin: center; }
.st-breathe  { animation: st-breathe 2.6s ease-in-out infinite; }
.st-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.14) transparent; }
.st-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.st-scroll::-webkit-scrollbar-track { background: transparent; }
.st-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }
@media (prefers-reduced-motion: reduce) {
    .st-rise, .st-wave-bar, .st-breathe { animation: none; }
}
`;

const FONT_STACK = "Inter, Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const GRADIENT_PRIMARY = 'linear-gradient(135deg, #1FA9E0, #3CCFC0)'; // ciano -> verde-água (a onda e o ponto do logo)
const GRADIENT_BUBBLE = 'linear-gradient(135deg, #1B5FA8, #1384BE)'; // azul-marinho -> azul (balão de quem fala, texto branco legível)
const GRADIENT_ROSE = 'linear-gradient(135deg, #e11d48, #f43f5e)';
const GRADIENT_ACCENT = 'linear-gradient(135deg, #1D6FD0, #2DC5F4)'; // azul -> ciano (botões e seleções)

const PERSONA_OPTIONS = [
    { value: 'alex', label: 'Alex', role: 'Amigo casual' },
    { value: 'sarah', label: 'Ms. Sarah', role: 'Professora de inglês' },
    { value: 'mr_smith', label: 'Mr. Smith', role: 'Executivo de negócios' }
];

const TOPIC_OPTIONS = [
    { value: 'diário', label: 'Dia a dia' },
    { value: 'viagem', label: 'Viagem' },
    { value: 'trabalho', label: 'Trabalho' }
];

const LEVEL_OPTIONS = [
    { value: 'iniciante', label: 'Iniciante' },
    { value: 'intermediário', label: 'Intermediário' },
    { value: 'avançado', label: 'Avançado' }
];

function findOption(options, value) {
    const key = String(value || '').toLowerCase();
    return options.find(option => option.value === key) || options[0];
}

/* ------------------------------------------------------------------ */
/* Ícones SVG minimalistas (sem biblioteca externa)                    */
/* ------------------------------------------------------------------ */
function Svg({ className = 'h-4 w-4', children, strokeWidth = 1.8 }) {
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

function IconMic({ className }) {
    return (
        <Svg className={className} strokeWidth={2}>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
        </Svg>
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

function IconKeyboard({ className }) {
    return (
        <Svg className={className}>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01" />
            <path d="M10 8h.01" />
            <path d="M14 8h.01" />
            <path d="M18 8h.01" />
            <path d="M8 12h.01" />
            <path d="M12 12h.01" />
            <path d="M16 12h.01" />
            <path d="M7 16h10" />
        </Svg>
    );
}

function IconStop({ className }) {
    return (
        <Svg className={className}>
            <rect x="6" y="6" width="12" height="12" rx="2" />
        </Svg>
    );
}

function IconReplay({ className }) {
    return (
        <Svg className={className}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </Svg>
    );
}

function IconSliders({ className }) {
    return (
        <Svg className={className}>
            <path d="M21 4h-7" />
            <path d="M10 4H3" />
            <path d="M21 12h-9" />
            <path d="M8 12H3" />
            <path d="M21 20h-5" />
            <path d="M12 20H3" />
            <path d="M14 2v4" />
            <path d="M8 10v4" />
            <path d="M16 18v4" />
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

function IconClose({ className }) {
    return (
        <Svg className={className}>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </Svg>
    );
}

/* ------------------------------------------------------------------ */
/* Pequenos componentes visuais                                        */
/* ------------------------------------------------------------------ */
function TypingDots({ tone = 'text-slate-400' }) {
    return (
        <div className={`flex items-center gap-1.5 ${tone}`} aria-label="Carregando">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
        </div>
    );
}

function WaveBars({ count = 5 }) {
    return (
        <span className="flex h-6 items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <span
                    key={i}
                    className="st-wave-bar block h-6 w-[3px] rounded-full bg-white"
                    style={{ animationDelay: `${i * 120}ms` }}
                />
            ))}
        </span>
    );
}

function SmallPill({ onClick, disabled, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-semibold text-slate-200 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
            {label}
        </button>
    );
}

function IconCircleButton({ onClick, label, disabled, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}

/* ------------------------------------------------------------------ */
/* Microfone grande                                                    */
/* ------------------------------------------------------------------ */
const STATUS_TEXT = {
    idle: 'Toque e fale em português ou inglês',
    listening: 'Ouvindo… toque para enviar',
    practicing: 'Repita a frase em inglês…',
    processing: 'Pensando…',
    speaking: 'Falando… toque para interromper e responder'
};

function MicButton({ phase, level, onClick }) {
    const isListening = phase === 'listening' || phase === 'practicing';
    const isProcessing = phase === 'processing';
    const isSpeaking = phase === 'speaking';

    const label = isListening
        ? 'Enviar'
        : isProcessing
            ? 'Pensando'
            : isSpeaking
                ? 'Interromper e falar'
                : 'Falar';

    let background = GRADIENT_PRIMARY;
    if (isListening) background = GRADIENT_ROSE;
    if (isProcessing || isSpeaking) background = GRADIENT_ACCENT;

    return (
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
            {isListening && (
                <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-rose-500/30 transition-transform duration-100"
                    style={{ transform: `scale(${1 + level * 0.7})` }}
                />
            )}
            <button
                type="button"
                onClick={onClick}
                disabled={isProcessing}
                aria-label={label}
                className={`relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white shadow-xl transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 active:scale-95 disabled:cursor-wait ${
                    phase === 'idle' ? 'st-breathe' : ''
                }`}
                style={{ background }}
            >
                {isProcessing ? (
                    <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                ) : isListening || isSpeaking ? (
                    <WaveBars />
                ) : (
                    <IconMic className="h-8 w-8" />
                )}
            </button>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Frase em inglês, com as palavras certas/erradas do treino           */
/* ------------------------------------------------------------------ */
function EnglishLine({ text, practice }) {
    if (!practice) return <>{text}</>;
    return (
        <>
            {practice.words.map((item, index) => (
                <span
                    key={`${item.word}-${index}`}
                    className={item.ok ? 'text-teal-300' : 'text-rose-300 underline decoration-rose-400/60 decoration-dotted underline-offset-4'}
                >
                    {item.word}{' '}
                </span>
            ))}
        </>
    );
}

function scoreStyle(score) {
    if (score >= 90) return { label: 'Excelente!', classes: 'text-teal-300 bg-teal-400/10 border-teal-400/30' };
    if (score >= 70) return { label: 'Quase lá', classes: 'text-amber-300 bg-amber-400/10 border-amber-400/30' };
    return { label: 'Tente de novo', classes: 'text-rose-300 bg-rose-400/10 border-rose-400/30' };
}

/* ------------------------------------------------------------------ */
/* Balões da conversa                                                  */
/* ------------------------------------------------------------------ */
function UserTurn({ turn, practice, showTranslations, canPractice, onSpeak, onPractice, onRetry }) {
    const isPending = turn.status === 'pending';
    const isError = turn.status === 'error';
    const isDone = turn.status === 'done';
    const feedback = practice ? scoreStyle(practice.score) : null;

    return (
        <div className="st-rise flex w-full shrink-0 flex-col items-end gap-2">
            {/* O que você disse */}
            <div
                className={`max-w-[88%] rounded-2xl border border-white/15 px-4 py-3 shadow-lg shadow-cyan-950/40 sm:max-w-[80%] ${isError ? 'opacity-80' : ''}`}
                style={{ background: GRADIENT_BUBBLE }}
            >
                {isPending ? (
                    <TypingDots tone="text-cyan-100" />
                ) : (
                    <p className="text-[15px] font-medium leading-relaxed text-white">
                        {turn.heard || 'Não entendi o áudio.'}
                    </p>
                )}

                {isError && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-white/20 pt-2.5 text-xs text-rose-100">
                        <span>Não foi enviada.</span>
                        {turn.heard && (
                            <button
                                type="button"
                                onClick={() => onRetry(turn.id)}
                                className="cursor-pointer font-semibold underline underline-offset-2 hover:text-white"
                            >
                                Tentar de novo
                            </button>
                        )}
                    </div>
                )}

                {isDone && turn.userLanguage === 'en' && turn.portuguese && showTranslations && (
                    <p className="mt-2.5 border-t border-white/20 pt-2.5 text-sm italic leading-relaxed text-cyan-50/85">
                        {turn.portuguese}
                    </p>
                )}
            </div>

            {/* Você falou em português: "Diga assim" */}
            {isDone && turn.userLanguage === 'pt' && turn.english && (
                <div className="w-full max-w-[96%] rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4 sm:max-w-[88%]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300/90">Diga assim</span>
                    <p className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-white">
                        <EnglishLine text={turn.english} practice={practice} />
                    </p>
                    <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <SmallPill label="Ouvir" onClick={() => onSpeak(turn.english, 0.9)}>
                            <IconSpeaker className="h-4 w-4" />
                        </SmallPill>
                        <SmallPill label="Devagar" onClick={() => onSpeak(turn.english, 0.55)}>
                            <IconSlow className="h-4 w-4" />
                        </SmallPill>
                        <SmallPill label="Repetir" disabled={!canPractice} onClick={() => onPractice(turn.id)}>
                            <IconMic className="h-4 w-4" />
                        </SmallPill>
                    </div>
                    {practice && feedback && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3.5">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${feedback.classes}`}>
                                {practice.score}% · {feedback.label}
                            </span>
                            <span className="text-xs text-slate-400">
                                Eu ouvi: <span className="italic text-slate-300">{practice.heard}</span>
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Você falou em inglês com um deslize: "Mais natural" */}
            {isDone && turn.userLanguage === 'en' && turn.correction && (
                <div className="flex w-full max-w-[96%] items-start justify-between gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.06] p-4 sm:max-w-[88%]">
                    <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">Mais natural</span>
                        <p className="mt-1 text-base font-semibold leading-snug text-white">{turn.correction}</p>
                    </div>
                    <IconCircleButton label="Ouvir versão mais natural" onClick={() => onSpeak(turn.correction, 0.9)}>
                        <IconSpeaker className="h-4 w-4" />
                    </IconCircleButton>
                </div>
            )}
        </div>
    );
}

function AiTurn({ turn, showTranslations, onSpeak }) {
    return (
        <div className="st-rise flex w-full shrink-0 flex-col items-start gap-1.5">
            <div className="max-w-[88%] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:max-w-[80%]">
                <p className="text-[15px] font-medium leading-relaxed text-white">{turn.text}</p>
                {showTranslations && turn.translation && (
                    <p className="mt-2.5 border-t border-white/10 pt-2.5 text-sm italic leading-relaxed text-slate-400">
                        {turn.translation}
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={() => onSpeak(turn.text, 0.9)}
                aria-label="Ouvir resposta"
                title="Ouvir resposta"
                className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
                <IconSpeaker className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Painel de ajustes (substitui a antiga tela de Setup)                */
/* ------------------------------------------------------------------ */
function OptionChips({ options, value, onSelect }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onSelect(option.value)}
                        aria-pressed={isActive}
                        className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                            isActive
                                ? 'border-white/20 text-white shadow-md'
                                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                        style={isActive ? { background: GRADIENT_ACCENT } : undefined}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function Toggle({ checked, onChange, label, hint }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors duration-200 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
            <span>
                <span className="block text-sm font-medium text-slate-100">{label}</span>
                {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
            </span>
            <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? '' : 'bg-white/15'}`}
                style={checked ? { background: GRADIENT_PRIMARY } : undefined}
            >
                <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-[22px]' : 'left-0.5'}`}
                />
            </span>
        </button>
    );
}

function SettingsSheet({ settings, onChange, onClose, onClear, onOpenChat, onOpenQuick }) {
    const persona = findOption(PERSONA_OPTIONS, settings.persona).value;
    const topic = findOption(TOPIC_OPTIONS, settings.topic).value;
    const level = findOption(LEVEL_OPTIONS, settings.level).value;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Ajustes">
            <button
                type="button"
                aria-label="Fechar ajustes"
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
            />
            <div
                className="st-rise relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl sm:rounded-3xl sm:p-6 st-scroll"
                style={{ fontFamily: FONT_STACK }}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold tracking-tight text-white">Ajustes</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <IconClose className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex flex-col gap-5">
                    <section>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Com quem você fala</h3>
                        <OptionChips options={PERSONA_OPTIONS} value={persona} onSelect={(value) => onChange({ persona: value })} />
                    </section>
                    <section>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assunto</h3>
                        <OptionChips options={TOPIC_OPTIONS} value={topic} onSelect={(value) => onChange({ topic: value })} />
                    </section>
                    <section>
                        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Seu nível</h3>
                        <OptionChips options={LEVEL_OPTIONS} value={level} onSelect={(value) => onChange({ level: value })} />
                    </section>

                    <section className="flex flex-col gap-2">
                        <Toggle
                            label="Falar as respostas"
                            hint="A IA lê a resposta em voz alta (mais devagar no nível iniciante)"
                            checked={settings.autoSpeak !== false}
                            onChange={(value) => onChange({ autoSpeak: value })}
                        />
                        <Toggle
                            label="Mãos livres"
                            hint="Depois que a IA fala, o microfone abre sozinho"
                            checked={Boolean(settings.handsFree)}
                            onChange={(value) => onChange({ handsFree: value })}
                        />
                        <Toggle
                            label="Mostrar traduções"
                            hint="Exibe o português embaixo das frases"
                            checked={settings.showTranslations !== false}
                            onChange={(value) => onChange({ showTranslations: value })}
                        />
                    </section>

                    <section className="flex flex-col gap-2 border-t border-white/10 pt-4">
                        <button
                            type="button"
                            onClick={onClear}
                            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                        >
                            Limpar conversa
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={onOpenQuick}
                                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                            >
                                Frase rápida
                            </button>
                            <button
                                type="button"
                                onClick={onOpenChat}
                                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                            >
                                Conversa por texto
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */
export default function Talk({ settings, onChangeSettings, onOpenChat, onOpenQuick }) {
    const {
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
    } = useTalk(settings);

    const [inputText, setInputText] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showTextInput, setShowTextInput] = useState(
        () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches
    );
    const endRef = useRef(null);

    useEffect(() => {
        if (endRef.current && typeof endRef.current.scrollIntoView === 'function') {
            endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [turns, phase]);

    const persona = findOption(PERSONA_OPTIONS, settings.persona);
    const topicOption = findOption(TOPIC_OPTIONS, settings.topic);
    const levelOption = findOption(LEVEL_OPTIONS, settings.level);
    const showTranslations = settings.showTranslations !== false;

    const isBusy = phase === 'processing' || phase === 'listening' || phase === 'practicing';
    const lastTurn = turns[turns.length - 1];
    const suggestions = lastTurn && lastTurn.role === 'ai' && phase !== 'processing' && phase !== 'listening' && phase !== 'practicing'
        ? lastTurn.suggestions || []
        : [];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim() || isBusy) return;
        sendText(inputText);
        setInputText('');
    };

    const speakTurnText = (text, rate) => speak(text, { lang: 'en-US', rate });

    const statusText = voiceAvailable ? STATUS_TEXT[phase] : 'Este navegador não grava áudio. Use o texto.';

    return (
        <>
            <style>{TALK_STYLES}</style>

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

            {/* No celular ocupa a tela toda; no computador vira um card de vidro */}
            <div
                className="fixed left-0 top-0 z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white/[0.03] text-slate-100 backdrop-blur-md sm:static sm:mx-auto sm:h-[94vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.04] sm:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)]"
                style={{ fontFamily: FONT_STACK }}
            >
                {/* Cabeçalho */}
                <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white shadow-md"
                            style={{ background: GRADIENT_ACCENT }}
                        >
                            {persona.label.replace('Ms. ', '').replace('Mr. ', '').charAt(0)}
                        </div>
                        <div className="min-w-0 leading-tight">
                            <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">{persona.label}</h1>
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                                {topicOption.label} · {levelOption.label}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        aria-label="Ajustes"
                        title="Ajustes"
                        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                    >
                        <IconSliders className="h-[18px] w-[18px]" />
                    </button>
                </header>

                {/* Conversa */}
                <div className="st-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6">
                    {turns.map((turn) => (
                        turn.role === 'ai' ? (
                            <AiTurn
                                key={turn.id}
                                turn={turn}
                                showTranslations={showTranslations}
                                onSpeak={speakTurnText}
                            />
                        ) : (
                            <UserTurn
                                key={turn.id}
                                turn={turn}
                                practice={practice && practice.turnId === turn.id ? practice : null}
                                showTranslations={showTranslations}
                                canPractice={voiceAvailable && !isBusy}
                                onSpeak={speakTurnText}
                                onPractice={practiceTurn}
                                onRetry={retryTurn}
                            />
                        )
                    ))}

                    {suggestions.length > 0 && (
                        <div className="st-scroll -mx-1 flex shrink-0 gap-2.5 overflow-x-auto px-1 pb-2 pt-1">
                            {suggestions.map((sug, idx) => (
                                <button
                                    key={`${lastTurn.id}-${idx}`}
                                    type="button"
                                    onClick={() => sendText(sug.en || sug.pt)}
                                    className="group relative min-w-[200px] max-w-[280px] shrink-0 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                                >
                                    <span className="block text-[13px] font-semibold leading-snug text-slate-100">{sug.en}</span>
                                    {showTranslations && sug.pt && (
                                        <span className="mt-1 block text-[11px] italic leading-snug text-slate-400">{sug.pt}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Rodapé: erro, texto e microfone */}
                <div className="border-t border-white/10 bg-black/20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    {errorMessage && (
                        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
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

                    {showTextInput && (
                        <form
                            onSubmit={handleSubmit}
                            className="mb-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-5 pr-1.5 transition-all duration-200 focus-within:border-sky-400/60 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-sky-500/40"
                        >
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Ou digite aqui, em português ou inglês..."
                                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || isBusy}
                                aria-label="Enviar texto"
                                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100"
                                style={{ background: GRADIENT_ACCENT }}
                            >
                                <IconSend className="h-4 w-4" />
                            </button>
                        </form>
                    )}

                    <div className="flex items-center justify-center gap-7">
                        <IconCircleButton
                            label={showTextInput ? 'Esconder o teclado' : 'Digitar'}
                            onClick={() => setShowTextInput(!showTextInput)}
                        >
                            <IconKeyboard className="h-5 w-5" />
                        </IconCircleButton>

                        <MicButton phase={voiceAvailable ? phase : 'idle'} level={level} onClick={toggleTalk} />

                        {phase === 'speaking' ? (
                            <IconCircleButton label="Parar de falar" onClick={stopSpeaking}>
                                <IconStop className="h-5 w-5" />
                            </IconCircleButton>
                        ) : (
                            <IconCircleButton label="Ouvir a última resposta de novo" onClick={replayLast}>
                                <IconReplay className="h-5 w-5" />
                            </IconCircleButton>
                        )}
                    </div>

                    <p className="mt-2.5 text-center text-xs text-slate-400" aria-live="polite">
                        {statusText}
                    </p>
                    <p className="mt-1 hidden text-center text-[11px] text-slate-500 sm:block">
                        No computador, aperte{' '}
                        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                            Espaço
                        </kbd>{' '}
                        para falar e enviar
                    </p>
                </div>
            </div>

            {showSettings && (
                <SettingsSheet
                    settings={settings}
                    onChange={onChangeSettings}
                    onClose={() => setShowSettings(false)}
                    onClear={() => {
                        clearConversation();
                        setShowSettings(false);
                    }}
                    onOpenChat={onOpenChat}
                    onOpenQuick={onOpenQuick}
                />
            )}
        </>
    );
}