// backend/src/utils/prompt.js
// Fonte única de verdade para persona, tópico, nível, prompt do sistema e histórico.
// Usado tanto pelo geminiService quanto pelo groqService.

const SUGGESTION_COUNT = 3; // troque para 2 se preferir apenas 2 sugestões
const MAX_HISTORY_MESSAGES = 20; // limita o histórico enviado à IA

const PERSONAS = {
    friendly: "You are Alex, a friendly and casual English-speaking friend. You're chatty, warm, and love helping your friend practice English. Keep the conversation natural and fun. Use casual language, slang when appropriate, and be encouraging.",
    teacher: "You are Ms. Sarah, a patient and experienced English teacher. You help the student improve their English. You sometimes introduce a new word and briefly explain it. You are encouraging but thorough.",
    executive: "You are Mr. Smith, a professional business executive. You speak formal business English: polite, precise and professional. You discuss meetings, negotiations, emails, presentations and career topics, and you occasionally suggest a more professional way to phrase something."
};

const TOPICS = {
    daily: "everyday conversations like greeting neighbors, talking about the weather, making small talk, hobbies and daily routines",
    travel: "travel situations like asking for directions, booking hotels, being at the airport, ordering at restaurants and sightseeing",
    work: "workplace conversations like meetings, presentations, talking to colleagues, emails and career topics"
};

const LEVELS = {
    beginner: "Use simple vocabulary and short sentences. Focus on basic phrases.",
    intermediate: "Use moderate vocabulary with some idioms. Include varied sentence structures.",
    advanced: "Use sophisticated vocabulary, idioms, and complex sentence structures."
};

function norm(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

// Aceita tanto os ids (teacher) quanto os valores/rótulos do menu ("sarah", "Sarah (Professora)", "mr_smith")
function resolvePersona(value) {
    const s = norm(value);
    if (PERSONAS[s]) return s;
    if (/sarah|teacher|professor/.test(s)) return 'teacher';
    if (/smith|executiv|business|negocio/.test(s)) return 'executive';
    return 'friendly'; // alex / amigo / padrão
}

function resolveTopic(value) {
    const s = norm(value);
    if (TOPICS[s]) return s;
    if (/viag|travel|trip|turis/.test(s)) return 'travel';
    if (/trabalh|work|negoc|carreira/.test(s)) return 'work';
    return 'daily'; // diário / dia a dia / padrão
}

function resolveLevel(value) {
    const s = norm(value);
    if (LEVELS[s]) return s;
    if (/inici|begin|basic/.test(s)) return 'beginner';
    if (/interm/.test(s)) return 'intermediate';
    if (/avan|advanc/.test(s)) return 'advanced';
    return 'beginner';
}

function buildSystemInstruction(context = {}) {
    const persona = resolvePersona(context.persona);
    const topic = resolveTopic(context.topic);
    const level = resolveLevel(context.level);

    return `${PERSONAS[persona]}

CONTEXT
- Topic focus: ${TOPICS[topic]}
- Student level: ${level}. ${LEVELS[level]}
- The student is a Brazilian Portuguese speaker practicing English by chatting with you.
- The conversation so far is provided as previous turns. The LAST user turn is the new message you must answer.

HOW TO ANSWER
1. First react naturally to what the student JUST said (a comment, reaction or short answer), then continue the conversation.
2. Keep "reply" short (1-2 sentences) and always in English, adapted to the student's level.
3. Read your previous turns and NEVER repeat a question you already asked. Move the conversation forward with something new related to the topic.
4. "userLanguage": "pt" if the student's last message is written in Portuguese or mixes Portuguese and English, "en" only if it is entirely in English.
5. "userTranslation": translate ONLY the student's last message. If it is Portuguese, translate it into natural English. If it is English, translate it into natural Brazilian Portuguese. Translate what was said keeping the same tone and register (casual stays casual, polite stays polite) and the same meaning; the student's level only affects how simple or rich the vocabulary is, never the meaning. If the message mixes Portuguese and English, give the whole sentence in natural English. Never answer it, never add greetings, never invent content.
6. "translation": the Brazilian Portuguese translation of your own "reply".
7. "suggestions": exactly ${SUGGESTION_COUNT} different things the student could say next in response to YOUR reply, ordered from simplest (1-5 words) to most elaborate. Each has "en" (English) and "pt" (Portuguese translation). They must change every turn and fit your latest question.
8. "correction": only when the student's last message is written entirely in English and has a mistake or sounds unnatural, give a short corrected or more natural English version of what they said. Otherwise return an empty string.

OUTPUT FORMAT
Return ONLY one valid JSON object, no markdown and no text outside the JSON, with exactly these keys:
{
  "userLanguage": "pt" or "en",
  "userTranslation": "string",
  "correction": "string",
  "reply": "string",
  "translation": "string",
  "suggestions": [ { "en": "string", "pt": "string" } ]
}`;
}

// Converte qualquer formato de histórico em [{ role: 'user' | 'assistant', content }]
function normalizeHistory(history, currentMessage) {
    if (!Array.isArray(history)) return [];

    const cleaned = [];
    for (const item of history) {
        if (!item || typeof item !== 'object') continue;

        let content = item.content ?? item.text ?? '';
        if (!content && Array.isArray(item.parts)) {
            content = item.parts.map(p => (p && p.text) || '').join('');
        }
        content = String(content || '').trim();
        if (!content || /traduzindo/i.test(content)) continue; // ignora placeholders de loading

        const rawRole = String(item.role || item.who || '').toLowerCase();
        const role = rawRole === 'user' ? 'user' : 'assistant'; // model/ai/assistant => assistant

        const last = cleaned[cleaned.length - 1];
        if (last && last.role === role) {
            last.content += '\n' + content;
        } else {
            cleaned.push({ role, content });
        }
    }

    // Se o frontend já incluiu a mensagem atual no fim do histórico, remove para não duplicar
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === 'user' && last.content.trim() === String(currentMessage || '').trim()) {
        cleaned.pop();
    }

    return cleaned;
}

// Histórico + mensagem atual, sempre alternando papéis e começando por 'user'
function buildTurns(history, currentMessage) {
    let turns = normalizeHistory(history, currentMessage).slice(-MAX_HISTORY_MESSAGES);

    const last = turns[turns.length - 1];
    if (last && last.role === 'user') {
        last.content += '\n' + String(currentMessage).trim();
    } else {
        turns.push({ role: 'user', content: String(currentMessage).trim() });
    }

    if (turns[0].role !== 'user') {
        turns.unshift({ role: 'user', content: '(The student starts the conversation.)' });
    }

    return turns;
}

module.exports = {
    SUGGESTION_COUNT,
    TOPICS,
    LEVELS,
    resolvePersona,
    resolveTopic,
    resolveLevel,
    buildSystemInstruction,
    normalizeHistory,
    buildTurns
};