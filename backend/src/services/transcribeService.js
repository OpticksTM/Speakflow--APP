// backend/src/services/transcribeService.js
// Transcrição de voz (fala -> texto) com o Whisper do Groq. Detecta sozinho se você falou
// português, inglês ou uma mistura dos dois.

const Groq = require('groq-sdk');

// Modelo multilíngue e rápido. Para trocar sem mexer no código, defina GROQ_STT_MODEL no .env.
const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8 MB (bem mais que 30 s de fala)
const MIN_AUDIO_BYTES = 1000;            // abaixo disso é só ruído/clique

// Extensões que o Groq aceita: flac, mp3, mp4, m4a, mpeg, mpga, ogg, wav, webm
const MIME_EXTENSIONS = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
    'audio/aac': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/flac': 'flac'
};

// Frases que o Whisper costuma "inventar" quando recebe silêncio
const SILENCE_HALLUCINATIONS = [
    /thanks? for watching/i,
    /legendas? pela comunidade/i,
    /subtitles? by/i,
    /amara\.org/i,
    /obrigado por assistir/i,
    /inscreva-se no canal/i
];

class TranscriptionError extends Error {
    constructor(message, code, status) {
        super(message);
        this.name = 'TranscriptionError';
        this.code = code;
        this.status = status;
    }
}

let client = null;
function getClient() {
    if (!process.env.GROQ_API_KEY) {
        throw new TranscriptionError(
            'A voz precisa da GROQ_API_KEY no arquivo .env do backend.',
            'STT_UNAVAILABLE',
            503
        );
    }
    if (!client) {
        client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return client;
}

function cleanMime(mimeType) {
    return String(mimeType || '').split(';')[0].trim().toLowerCase();
}

// Valida e converte o áudio em base64 (aceita também "data:audio/webm;base64,...")
function decodeAudio(audio, mimeType) {
    if (typeof audio !== 'string' || !audio.trim()) {
        throw new TranscriptionError('Nenhum áudio foi enviado.', 'NO_AUDIO', 400);
    }

    const mime = cleanMime(mimeType);
    const extension = MIME_EXTENSIONS[mime];
    if (!extension) {
        throw new TranscriptionError(`Formato de áudio não suportado (${mime || 'desconhecido'}).`, 'BAD_FORMAT', 400);
    }

    const base64 = audio.includes(',') ? audio.slice(audio.indexOf(',') + 1) : audio;
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > MAX_AUDIO_BYTES) {
        throw new TranscriptionError('O áudio ficou muito longo. Fale frases mais curtas.', 'AUDIO_TOO_LARGE', 413);
    }
    if (buffer.length < MIN_AUDIO_BYTES) {
        throw new TranscriptionError('Não consegui ouvir nada. Tente falar de novo.', 'NO_SPEECH', 422);
    }

    return { buffer, extension, mime };
}

// Se o Whisper indicar que todos os trechos são "sem fala", trata como silêncio
function isMostlySilence(segments) {
    if (!Array.isArray(segments) || segments.length === 0) return false;
    const probs = segments
        .map(segment => segment && segment.no_speech_prob)
        .filter(value => typeof value === 'number');
    return probs.length > 0 && probs.every(value => value > 0.85);
}

// Devolve { text }. "language" é opcional ('pt' ou 'en'); sem ele o Whisper detecta sozinho.
async function transcribeAudio({ audio, mimeType, language }) {
    const { buffer, extension, mime } = decodeAudio(audio, mimeType);
    const groq = getClient();

    const file = await Groq.toFile(buffer, `audio.${extension}`, { type: mime });

    const params = {
        file,
        model: STT_MODEL,
        response_format: 'verbose_json',
        temperature: 0
    };
    if (language === 'pt' || language === 'en') params.language = language;

    const response = await groq.audio.transcriptions.create(params);

    const text = String((response && response.text) || '').trim();
    const noSpeech = !text ||
        isMostlySilence(response && response.segments) ||
        SILENCE_HALLUCINATIONS.some(pattern => pattern.test(text));

    if (noSpeech) {
        throw new TranscriptionError('Não consegui ouvir nada. Tente falar de novo.', 'NO_SPEECH', 422);
    }

    return { text };
}

module.exports = { transcribeAudio, TranscriptionError };