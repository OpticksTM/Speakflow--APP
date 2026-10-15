// backend/src/utils/aiJson.js
// Transforma a saída bruta da IA em um objeto limpo e previsível:
// { userLanguage, userTranslation, reply, translation, suggestions: [{ en, pt }] }

const PT_WORDS = new Set([
    'eu', 'voce', 'nao', 'sim', 'esta', 'estou', 'bem', 'obrigado', 'obrigada', 'oi', 'ola', 'tudo',
    'que', 'uma', 'um', 'para', 'com', 'por', 'mais', 'mas', 'como', 'meu', 'minha', 'seu', 'sua',
    'e', 'de', 'do', 'da', 'em', 'no', 'na', 'gosto', 'quero', 'vou', 'tenho', 'muito', 'bom', 'boa',
    'dia', 'tarde', 'noite', 'quando', 'onde', 'porque', 'tambem', 'isso', 'esse', 'essa', 'aqui',
    'la', 'fazer', 'ser', 'ter', 'sou', 'foi', 'vamos', 'pode', 'preciso', 'gostaria', 'falar'
]);

const EN_WORDS = new Set([
    'i', 'you', 'the', 'and', 'is', 'are', 'am', 'was', 'my', 'me', 'what', 'how', 'to', 'of', 'in',
    'it', 'that', 'this', 'with', 'for', 'do', 'does', 'have', 'like', 'want', 'going', 'hello', 'hi',
    'yes', 'no', 'not', 'good', 'well', 'thanks', 'thank', 'your', 'can', 'will', 'would', 'about',
    'we', 'they', 'he', 'she', 'where', 'when', 'why', 'there', 'here', 'so', 'but', 'just', 'im'
]);

function formatError(message) {
    const err = new Error(message);
    err.isFormatError = true; // o serviço usa isso para tentar de novo uma vez
    return err;
}

// Detecção simples, usada só quando a IA não informa userLanguage
function detectLanguage(text) {
    const raw = String(text || '').toLowerCase();
    const accentScore = (raw.match(/[ãõçáéíóúâêô]/g) || []).length * 2;
    const words = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z']+/)
        .filter(Boolean);

    let pt = accentScore;
    let en = 0;
    for (const w of words) {
        if (PT_WORDS.has(w)) pt++;
        if (EN_WORDS.has(w)) en++;
    }
    return pt > en ? 'pt' : 'en';
}

// Extrai o objeto JSON mesmo que venha com ```json, texto extra ou já como objeto
function parseAiJson(raw) {
    if (raw && typeof raw === 'object') return raw;
    if (!raw || typeof raw !== 'string') throw formatError('A IA retornou uma resposta vazia.');

    let text = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw formatError('A IA não retornou um objeto JSON.');
    }
    text = text.substring(start, end + 1);

    try {
        return JSON.parse(text);
    } catch (e) {
        throw formatError('JSON inválido retornado pela IA: ' + e.message);
    }
}

function str(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeSuggestions(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map(item => {
            if (typeof item === 'string') return { en: item.trim(), pt: '' };
            if (item && typeof item === 'object') {
                return { en: str(item.en || item.text), pt: str(item.pt || item.translation) };
            }
            return null;
        })
        .filter(item => item && item.en);
}

function normalizeAiResponse(parsed, userMessage) {
    let data = parsed;

    // Desembrulha formatos como { reply: { reply: "..." } } ou { data: {...} }
    for (let i = 0; i < 3; i++) {
        if (data && typeof data.reply === 'object' && data.reply !== null) {
            const { reply: inner, ...outer } = data;
            data = { ...outer, ...inner }; // mantém suggestions etc. do nível externo
        } else if (data && !data.reply && !data.response && data.data && typeof data.data === 'object') {
            const { data: inner, ...outer } = data;
            data = { ...outer, ...inner };
        } else {
            break;
        }
    }

    const reply = str(data && (data.reply ?? data.response));
    if (!reply) throw formatError('A resposta da IA não contém o campo "reply".');

    const modelLang = str(data.userLanguage).toLowerCase();
    const userLanguage = modelLang === 'pt' || modelLang === 'en' ? modelLang : detectLanguage(userMessage);

    // Correção só faz sentido para quem falou inglês, e só se for diferente do que foi dito
    const sameText = (a, b) => String(a).toLowerCase().replace(/[^a-z0-9]/g, '') === String(b).toLowerCase().replace(/[^a-z0-9]/g, '');
    let correction = str(data.correction);
    if (userLanguage !== 'en' || sameText(correction, userMessage)) correction = '';

    return {
        userLanguage,
        userTranslation: str(data.userTranslation),
        correction,
        reply,
        translation: str(data.translation),
        suggestions: normalizeSuggestions(data.suggestions)
    };
}

module.exports = { parseAiJson, normalizeAiResponse, detectLanguage, formatError };